import type {
  EWayBillDocumentType,
  EWayBillStatus,
  EWayTransportMode,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildEWayDraftFromInvoice, existingEWayForInvoice } from "@/lib/eway/build-from-invoice";
import {
  buildEWayDraftFromDeliveryChallan,
  existingEWayForDeliveryChallan,
} from "@/lib/eway/build-from-delivery-challan";
import {
  buildEWayDraftFromPurchaseReturn,
  existingEWayForPurchaseReturn,
} from "@/lib/eway/build-from-purchase-return";
import type { EWayDraftPayload } from "@/lib/eway/build-document";
import { decryptEWayCredentials } from "@/lib/eway/credentials";
import {
  billToGspPayload,
  gspCancelEWayBill,
  gspExtendValidity,
  gspGenerateEWayBill,
  gspUpdateVehicle,
} from "@/lib/eway/gsp-client";
import { validateEWayBillInput, normalizeVehicleNumber } from "@/lib/eway/validation";
import { EWAY_STATUS_LABELS } from "@/lib/eway/constants";

const ewayInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  customer: { select: { id: true, displayName: true, gstin: true } },
  vehicleUpdates: { orderBy: { createdAt: "desc" as const }, take: 20 },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 30 },
  apiLogs: { orderBy: { createdAt: "desc" as const }, take: 10 },
} satisfies Prisma.EWayBillInclude;

export async function getOrCreateEWaySettings(userId: string) {
  return prisma.eWayBillSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function recordStatusChange(
  ewayBillId: string,
  fromStatus: EWayBillStatus | null,
  toStatus: EWayBillStatus,
  actorUserId: string,
  note?: string,
) {
  await prisma.eWayBillStatusHistory.create({
    data: { ewayBillId, fromStatus, toStatus, actorUserId, note },
  });
}

async function logApiCall(opts: {
  userId: string;
  ewayBillId?: string;
  action: string;
  requestJson?: unknown;
  responseJson?: unknown;
  httpStatus?: number;
  success: boolean;
  errorMessage?: string;
}) {
  await prisma.eWayBillApiLog.create({
    data: {
      userId: opts.userId,
      ewayBillId: opts.ewayBillId,
      action: opts.action,
      requestJson: opts.requestJson ? JSON.stringify(opts.requestJson) : null,
      responseJson: opts.responseJson ? JSON.stringify(opts.responseJson) : null,
      httpStatus: opts.httpStatus,
      success: opts.success,
      errorMessage: opts.errorMessage,
    },
  });
}

export async function refreshExpiredStatuses(userId: string) {
  const now = new Date();
  const expired = await prisma.eWayBill.findMany({
    where: {
      userId,
      status: { in: ["GENERATED", "IN_TRANSIT"] },
      validUntil: { lt: now },
    },
  });
  for (const b of expired) {
    await prisma.eWayBill.update({
      where: { id: b.id },
      data: { status: "EXPIRED" },
    });
    await recordStatusChange(b.id, b.status, "EXPIRED", userId, "Validity expired");
  }
}

export async function getEWayDashboardStats(userId: string) {
  await refreshExpiredStatuses(userId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [total, generatedToday, active, expired, cancelled, pending, failed] = await Promise.all([
    prisma.eWayBill.count({ where: { userId } }),
    prisma.eWayBill.count({ where: { userId, generatedAt: { gte: startOfDay } } }),
    prisma.eWayBill.count({ where: { userId, status: { in: ["GENERATED", "IN_TRANSIT"] } } }),
    prisma.eWayBill.count({ where: { userId, status: "EXPIRED" } }),
    prisma.eWayBill.count({ where: { userId, status: "CANCELLED" } }),
    prisma.eWayBill.count({ where: { userId, status: { in: ["DRAFT", "READY"] } } }),
    prisma.eWayBill.count({ where: { userId, status: "ERROR" } }),
  ]);

  return { total, generatedToday, active, expired, cancelled, pending, failed };
}

export type EWayListFilters = {
  from?: string;
  to?: string;
  customerId?: string;
  gstin?: string;
  invoiceNumber?: string;
  vehicleNumber?: string;
  status?: EWayBillStatus;
};

export async function listEWayBills(userId: string, filters: EWayListFilters, take = 100) {
  await refreshExpiredStatuses(userId);
  const where: Prisma.EWayBillWhereInput = { userId };

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const t = new Date(filters.to);
      t.setHours(23, 59, 59, 999);
      where.createdAt.lte = t;
    }
  }
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.gstin) {
    where.OR = [
      { supplierGstin: { contains: filters.gstin } },
      { recipientGstin: { contains: filters.gstin } },
    ];
  }
  if (filters.invoiceNumber) where.sourceDocumentNumber = { contains: filters.invoiceNumber };
  if (filters.vehicleNumber) where.vehicleNumber = { contains: normalizeVehicleNumber(filters.vehicleNumber) };
  if (filters.status) where.status = filters.status;

  return prisma.eWayBill.findMany({
    where,
    include: { customer: { select: { displayName: true } }, lines: { take: 1 } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getEWayBill(userId: string, id: string) {
  await refreshExpiredStatuses(userId);
  return prisma.eWayBill.findFirst({
    where: { id, userId },
    include: ewayInclude,
  });
}

type PersistDraft = EWayDraftPayload & {
  invoiceId?: string | null;
  deliveryChallanId?: string | null;
  purchaseReturnId?: string | null;
  customerId?: string | null;
};

async function persistEWayDraft(userId: string, draft: PersistDraft, historyNote: string) {
  return prisma.eWayBill.create({
    data: {
      userId,
      status: "DRAFT",
      documentType: draft.documentType,
      invoiceId: draft.invoiceId ?? null,
      deliveryChallanId: draft.deliveryChallanId ?? null,
      purchaseReturnId: draft.purchaseReturnId ?? null,
      sourceDocumentNumber: draft.sourceDocumentNumber,
      sourceDocumentDate: draft.sourceDocumentDate,
      documentValue: draft.documentValue,
      supplierName: draft.supplierName,
      supplierGstin: draft.supplierGstin,
      supplierAddress: draft.supplierAddress,
      supplierStateCode: draft.supplierStateCode,
      supplierPincode: draft.supplierPincode,
      customerId: draft.customerId ?? null,
      recipientName: draft.recipientName,
      recipientGstin: draft.recipientGstin,
      recipientAddress: draft.recipientAddress,
      recipientStateCode: draft.recipientStateCode,
      recipientPincode: draft.recipientPincode,
      placeOfSupply: draft.placeOfSupply,
      supplyType: draft.supplyType,
      subSupplyType: draft.subSupplyType ?? null,
      lines: {
        create: draft.lines.map((l, i) => ({
          productName: l.productName,
          hsnCode: l.hsnCode,
          quantity: l.quantity,
          unit: l.unit,
          taxableValue: l.taxableValue,
          cgstRate: l.cgstRate,
          sgstRate: l.sgstRate,
          igstRate: l.igstRate,
          sortOrder: i,
        })),
      },
      statusHistory: {
        create: { toStatus: "DRAFT", actorUserId: userId, note: historyNote },
      },
    },
    include: ewayInclude,
  });
}

export async function createEWayFromInvoice(userId: string, invoiceId: string, documentType?: EWayBillDocumentType) {
  const dup = await existingEWayForInvoice(userId, invoiceId);
  if (dup?.ewayBillNumber) {
    throw new Error(`An active E-Way Bill (${dup.ewayBillNumber}) already exists for this invoice.`);
  }

  const draft = await buildEWayDraftFromInvoice(userId, invoiceId, documentType);
  if (!draft) throw new Error("Invoice not found.");

  const bill = await persistEWayDraft(
    userId,
    {
      ...draft,
      invoiceId: draft.invoiceId,
      customerId: draft.customerId,
    },
    "Created from invoice",
  );

  return { bill, automation: draft.automation };
}

export async function createEWayFromDeliveryChallan(userId: string, challanId: string) {
  const dup = await existingEWayForDeliveryChallan(userId, challanId);
  if (dup?.ewayBillNumber) {
    throw new Error(`An active E-Way Bill (${dup.ewayBillNumber}) already exists for this challan.`);
  }

  const draft = await buildEWayDraftFromDeliveryChallan(userId, challanId);
  if (!draft) throw new Error("Delivery challan not found.");

  const bill = await persistEWayDraft(
    userId,
    {
      ...draft,
      deliveryChallanId: draft.deliveryChallanId,
      customerId: draft.customerId,
    },
    "Created from delivery challan",
  );

  return { bill, automation: draft.automation };
}

export async function createEWayFromPurchaseReturn(userId: string, purchaseReturnId: string) {
  const dup = await existingEWayForPurchaseReturn(userId, purchaseReturnId);
  if (dup?.ewayBillNumber) {
    throw new Error(`An active E-Way Bill (${dup.ewayBillNumber}) already exists for this purchase return.`);
  }

  const draft = await buildEWayDraftFromPurchaseReturn(userId, purchaseReturnId);
  if (!draft) throw new Error("Purchase return not found.");

  const bill = await persistEWayDraft(
    userId,
    {
      ...draft,
      purchaseReturnId: draft.purchaseReturnId,
      customerId: null,
    },
    "Created from purchase return",
  );

  return { bill, automation: draft.automation };
}

export async function updateEWayDraft(
  userId: string,
  id: string,
  data: {
    transportMode?: EWayTransportMode;
    vehicleNumber?: string;
    distanceKm?: number;
    transporterName?: string;
    transporterGstin?: string;
    transporterId?: string;
    status?: "DRAFT" | "READY";
  },
) {
  const bill = await getEWayBill(userId, id);
  if (!bill) throw new Error("E-Way Bill not found.");
  if (!["DRAFT", "READY", "ERROR"].includes(bill.status)) {
    throw new Error("Only draft or error records can be edited.");
  }

  const updated = await prisma.eWayBill.update({
    where: { id },
    data: {
      transportMode: data.transportMode,
      vehicleNumber: data.vehicleNumber ? normalizeVehicleNumber(data.vehicleNumber) : undefined,
      distanceKm: data.distanceKm,
      transporterName: data.transporterName,
      transporterGstin: data.transporterGstin,
      transporterId: data.transporterId,
      status: data.status ?? bill.status,
      errorMessage: bill.status === "ERROR" ? null : undefined,
    },
    include: ewayInclude,
  });

  if (data.status && data.status !== bill.status) {
    await recordStatusChange(id, bill.status, data.status, userId, "Marked ready for submission");
  }

  return updated;
}

export async function generateEWayBill(userId: string, id: string) {
  const bill = await getEWayBill(userId, id);
  if (!bill) throw new Error("E-Way Bill not found.");
  if (bill.ewayBillNumber) throw new Error("E-Way Bill already generated. Cancel before re-generating.");

  const validation = validateEWayBillInput({
    documentType: bill.documentType,
    documentValue: Number(bill.documentValue),
    supplierGstin: bill.supplierGstin,
    supplierStateCode: bill.supplierStateCode,
    supplierPincode: bill.supplierPincode,
    recipientGstin: bill.recipientGstin,
    recipientStateCode: bill.recipientStateCode,
    recipientPincode: bill.recipientPincode,
    transportMode: bill.transportMode,
    vehicleNumber: bill.vehicleNumber,
    distanceKm: bill.distanceKm,
    transporterGstin: bill.transporterGstin,
    lines: bill.lines.map((l) => ({
      productName: l.productName,
      hsnCode: l.hsnCode,
      taxableValue: Number(l.taxableValue),
    })),
    forSubmission: true,
  });

  if (!validation.valid) {
    await prisma.eWayBill.update({
      where: { id },
      data: { status: "ERROR", errorMessage: validation.errors.join(" ") },
    });
    await recordStatusChange(id, bill.status, "ERROR", userId, validation.errors.join("; "));
    throw new Error(validation.errors.join(" "));
  }

  const settings = await getOrCreateEWaySettings(userId);
  const creds = decryptEWayCredentials(settings.apiCredentialsEnc);
  const payload = billToGspPayload(bill);

  const result = await gspGenerateEWayBill(payload, {
    sandbox: settings.sandboxMode,
    credentials: creds as Record<string, unknown>,
  });

  await logApiCall({
    userId,
    ewayBillId: id,
    action: "GENERATE",
    requestJson: payload,
    responseJson: result.raw ?? result,
    httpStatus: result.httpStatus,
    success: result.success,
    errorMessage: result.error,
  });

  if (!result.success || !result.ewayBillNo) {
    await prisma.eWayBill.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: result.error ?? "Generation failed",
        lastApiResponseJson: JSON.stringify(result.raw ?? result),
      },
    });
    await recordStatusChange(id, bill.status, "ERROR", userId, result.error);
    throw new Error(result.error ?? "E-Way Bill generation failed.");
  }

  const validUntil = result.validUpto ? new Date(result.validUpto) : new Date(Date.now() + 86400000);
  const updated = await prisma.eWayBill.update({
    where: { id },
    data: {
      status: "GENERATED",
      ewayBillNumber: result.ewayBillNo,
      generatedAt: new Date(),
      validUntil,
      qrCodeData: result.qrCode ?? null,
      apiAckNo: result.ackNo ?? null,
      errorMessage: null,
      lastApiResponseJson: JSON.stringify(result.raw ?? result),
    },
    include: ewayInclude,
  });

  await recordStatusChange(id, bill.status, "GENERATED", userId, `EBN ${result.ewayBillNo}`);
  return { bill: updated, warnings: validation.warnings };
}

export async function updateEWayVehicle(
  userId: string,
  id: string,
  opts: { vehicleNumber: string; transportMode?: EWayTransportMode; reason?: string },
) {
  const bill = await getEWayBill(userId, id);
  if (!bill?.ewayBillNumber) throw new Error("Generate E-Way Bill before updating vehicle.");

  const settings = await getOrCreateEWaySettings(userId);
  const vehicleNumber = normalizeVehicleNumber(opts.vehicleNumber);
  const result = await gspUpdateVehicle(bill.ewayBillNumber, vehicleNumber, { sandbox: settings.sandboxMode });

  await logApiCall({
    userId,
    ewayBillId: id,
    action: "UPDATE_VEHICLE",
    requestJson: { vehicleNumber, reason: opts.reason },
    responseJson: result.raw,
    httpStatus: result.httpStatus,
    success: result.success,
    errorMessage: result.error,
  });

  if (!result.success) throw new Error(result.error ?? "Vehicle update failed.");

  await prisma.eWayBillVehicleUpdate.create({
    data: {
      ewayBillId: id,
      userId,
      vehicleNumber,
      transportMode: opts.transportMode,
      reason: opts.reason,
      updatedFrom: bill.vehicleNumber,
      apiResponseJson: JSON.stringify(result.raw),
    },
  });

  return prisma.eWayBill.update({
    where: { id },
    data: {
      vehicleNumber,
      transportMode: opts.transportMode ?? bill.transportMode,
      status: "IN_TRANSIT",
    },
    include: ewayInclude,
  });
}

export async function extendEWayValidity(userId: string, id: string, reason?: string) {
  const bill = await getEWayBill(userId, id);
  if (!bill?.ewayBillNumber) throw new Error("E-Way Bill not generated.");

  const settings = await getOrCreateEWaySettings(userId);
  const result = await gspExtendValidity(bill.ewayBillNumber, { sandbox: settings.sandboxMode, reason });

  await logApiCall({
    userId,
    ewayBillId: id,
    action: "EXTEND",
    requestJson: { reason },
    responseJson: result.raw,
    httpStatus: result.httpStatus,
    success: result.success,
    errorMessage: result.error,
  });

  if (!result.success) throw new Error(result.error ?? "Extension failed.");

  const validUntil = result.validUpto ? new Date(result.validUpto) : new Date(Date.now() + 8 * 3600000);
  return prisma.eWayBill.update({
    where: { id },
    data: { validUntil, status: "GENERATED" },
    include: ewayInclude,
  });
}

export async function cancelEWayBill(userId: string, id: string, reason: string) {
  const bill = await getEWayBill(userId, id);
  if (!bill) throw new Error("E-Way Bill not found.");
  if (bill.status === "CANCELLED") throw new Error("Already cancelled.");

  if (bill.ewayBillNumber) {
    const settings = await getOrCreateEWaySettings(userId);
    const result = await gspCancelEWayBill(bill.ewayBillNumber, reason, { sandbox: settings.sandboxMode });
    await logApiCall({
      userId,
      ewayBillId: id,
      action: "CANCEL",
      requestJson: { reason },
      responseJson: result.raw,
      httpStatus: result.httpStatus,
      success: result.success,
      errorMessage: result.error,
    });
    if (!result.success) throw new Error(result.error ?? "Cancel failed on GSP.");
  }

  const updated = await prisma.eWayBill.update({
    where: { id },
    data: { status: "CANCELLED", errorMessage: null },
    include: ewayInclude,
  });
  await recordStatusChange(id, bill.status, "CANCELLED", userId, reason);
  return updated;
}

export function serializeEWayListRow(b: Awaited<ReturnType<typeof listEWayBills>>[number]) {
  return {
    id: b.id,
    status: b.status,
    statusLabel: EWAY_STATUS_LABELS[b.status],
    documentType: b.documentType,
    sourceDocumentNumber: b.sourceDocumentNumber,
    sourceDocumentDate: b.sourceDocumentDate.toISOString(),
    documentValue: Number(b.documentValue),
    ewayBillNumber: b.ewayBillNumber,
    customerName: b.customer?.displayName ?? b.recipientName,
    vehicleNumber: b.vehicleNumber,
    generatedAt: b.generatedAt?.toISOString() ?? null,
    validUntil: b.validUntil?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}
