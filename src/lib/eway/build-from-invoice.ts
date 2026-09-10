import type { EWayBillDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isInterState } from "@/lib/gst/split";
import { formatAddress, resolveNumericStateCode, stateNameFromCode } from "@/lib/eway/state-codes";
import { normalizeHsn, normalizePincode } from "@/lib/eway/validation";

export type EWayDraftFromInvoice = {
  documentType: EWayBillDocumentType;
  invoiceId: string;
  sourceDocumentNumber: string;
  sourceDocumentDate: Date;
  documentValue: number;
  supplierName: string;
  supplierGstin: string | null;
  supplierAddress: string;
  supplierStateCode: string | null;
  supplierPincode: string | null;
  customerId: string;
  recipientName: string;
  recipientGstin: string | null;
  recipientAddress: string;
  recipientStateCode: string | null;
  recipientPincode: string | null;
  placeOfSupply: string | null;
  supplyType: "O" | "I";
  lines: Array<{
    productName: string;
    hsnCode: string | null;
    quantity: number;
    unit: string;
    taxableValue: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
  }>;
  automation: {
    suggested: boolean;
    reasons: string[];
  };
};

export async function buildEWayDraftFromInvoice(
  userId: string,
  invoiceId: string,
  documentType: EWayBillDocumentType = "TAX_INVOICE",
): Promise<EWayDraftFromInvoice | null> {
  const [invoice, profile, settings] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        customer: true,
        lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.companyProfile.findUnique({ where: { userId } }),
    prisma.eWayBillSettings.findUnique({ where: { userId } }),
  ]);

  if (!invoice) return null;

  const inter = isInterState(profile?.gstin, invoice.customer.gstin);
  const supplierStateCode = resolveNumericStateCode({
    gstin: profile?.gstin,
    stateNameOrCode: profile?.billingState,
  });
  const recipientStateCode = resolveNumericStateCode({
    gstin: invoice.customer.gstin,
    stateNameOrCode: invoice.customer.billingState,
  });

  const documentValue = Number(invoice.payableTotal || invoice.total);
  const threshold = Number(settings?.valueThresholdInr ?? 50_000);

  const reasons: string[] = [];
  if (settings?.autoSuggestOverThreshold !== false && documentValue >= threshold) {
    reasons.push(`Invoice value Rs ${documentValue.toLocaleString("en-IN")} exceeds threshold Rs ${threshold.toLocaleString("en-IN")}.`);
  }
  if (settings?.autoSuggestInterstate !== false && inter) {
    reasons.push("Inter-state supply detected — E-Way Bill is typically required.");
  }

  const lines = invoice.lines.map((line, idx) => {
    const interLine = inter;
    const taxPct = Number(line.taxPercent);
    const half = interLine ? 0 : taxPct / 2;
    return {
      productName: line.description,
      hsnCode: normalizeHsn(line.item?.hsnCode),
      quantity: Number(line.quantity),
      unit: line.item?.unit ?? "NOS",
      taxableValue: Number(line.lineNet),
      cgstRate: interLine ? 0 : half,
      sgstRate: interLine ? 0 : half,
      igstRate: interLine ? taxPct : 0,
      sortOrder: idx,
    };
  });

  return {
    documentType,
    invoiceId: invoice.id,
    sourceDocumentNumber: invoice.invoiceNumber,
    sourceDocumentDate: invoice.issueDate,
    documentValue,
    supplierName: profile?.companyName ?? "Supplier",
    supplierGstin: profile?.gstin ?? null,
    supplierAddress: formatAddress([
      profile?.billingStreet,
      profile?.billingStreet2,
      profile?.billingCity,
      profile?.billingState,
      profile?.billingZip,
    ]),
    supplierStateCode,
    supplierPincode: normalizePincode(profile?.billingZip),
    customerId: invoice.customerId,
    recipientName: invoice.customer.displayName,
    recipientGstin: invoice.customer.gstin,
    recipientAddress: formatAddress([
      invoice.customer.billingStreet,
      invoice.customer.billingCity,
      invoice.customer.billingState,
      invoice.customer.billingZip,
    ]),
    recipientStateCode,
    recipientPincode: normalizePincode(invoice.customer.billingZip),
    placeOfSupply: stateNameFromCode(recipientStateCode) ?? invoice.customer.billingState,
    supplyType: inter ? "I" : "O",
    lines,
    automation: { suggested: reasons.length > 0, reasons },
  };
}

export async function existingEWayForInvoice(userId: string, invoiceId: string) {
  return prisma.eWayBill.findFirst({
    where: {
      userId,
      invoiceId,
      status: { notIn: ["CANCELLED", "ERROR"] },
    },
    orderBy: { createdAt: "desc" },
  });
}
