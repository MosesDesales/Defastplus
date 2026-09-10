import type { EWayBill, EWayBillLine } from "@prisma/client";

export type GspGeneratePayload = {
  docNo: string;
  docDate: string;
  supplyType: string;
  subSupplyType?: string;
  fromGstin?: string;
  toGstin?: string;
  transporterGstin?: string;
  vehicleNo?: string;
  transportMode: string;
  distance: number;
  itemList: Array<{
    productName: string;
    hsnCode: string;
    quantity: number;
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
  }>;
};

export type GspGenerateResult = {
  success: boolean;
  ewayBillNo?: string;
  validUpto?: string;
  qrCode?: string;
  ackNo?: string;
  raw?: unknown;
  error?: string;
  httpStatus?: number;
};

export type GspActionResult = GspGenerateResult;

function padEbn(n: number): string {
  return String(n).padStart(12, "0");
}

function mockEbn(): string {
  const ts = Date.now() % 1_000_000_000_000;
  return padEbn(ts);
}

function validUptoHours(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function buildQr(ebn: string, docNo: string): string {
  return `EWB:${ebn}|DOC:${docNo}|GEN:${new Date().toISOString()}`;
}

/** Sandbox / mock GSP — set EWAY_GSP_MODE=live + credentials for production NIC/GSP HTTP. */
export async function gspGenerateEWayBill(
  payload: GspGeneratePayload,
  opts: { sandbox: boolean; credentials?: Record<string, unknown> },
): Promise<GspGenerateResult> {
  const mode = process.env.EWAY_GSP_MODE?.trim() || (opts.sandbox ? "sandbox" : "live");

  if (mode === "sandbox" || opts.sandbox) {
    if (!payload.vehicleNo && payload.transportMode === "1") {
      return { success: false, error: "Vehicle number is required for road transport.", httpStatus: 400 };
    }
    const ebn = mockEbn();
    return {
      success: true,
      ewayBillNo: ebn,
      validUpto: validUptoHours(24),
      qrCode: buildQr(ebn, payload.docNo),
      ackNo: `ACK${Date.now()}`,
      raw: { mode: "sandbox", ewayBillNo: ebn },
      httpStatus: 200,
    };
  }

  const baseUrl = process.env.EWAY_GSP_BASE_URL?.trim();
  if (!baseUrl) {
    return {
      success: false,
      error: "EWAY_GSP_BASE_URL is not configured. Use sandbox mode or set live GSP endpoint.",
      httpStatus: 503,
    };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.credentials?.authToken ? { Authorization: `Bearer ${opts.credentials.authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: (raw as { error?: string }).error ?? `GSP error (${res.status})`,
        raw,
        httpStatus: res.status,
      };
    }
    const data = raw as { ewayBillNo?: string; validUpto?: string; qrCode?: string; ackNo?: string };
    return {
      success: true,
      ewayBillNo: data.ewayBillNo,
      validUpto: data.validUpto,
      qrCode: data.qrCode,
      ackNo: data.ackNo,
      raw,
      httpStatus: res.status,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "GSP network error",
      httpStatus: 502,
    };
  }
}

export async function gspUpdateVehicle(
  ewayBillNo: string,
  vehicleNo: string,
  opts: { sandbox: boolean },
): Promise<GspActionResult> {
  if (opts.sandbox || (process.env.EWAY_GSP_MODE?.trim() || "sandbox") === "sandbox") {
    return { success: true, raw: { ewayBillNo, vehicleNo, updated: true }, httpStatus: 200 };
  }
  const baseUrl = process.env.EWAY_GSP_BASE_URL?.trim();
  if (!baseUrl) return { success: false, error: "GSP not configured", httpStatus: 503 };
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/update-vehicle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ewayBillNo, vehicleNo }),
  });
  const raw = await res.json().catch(() => ({}));
  return res.ok
    ? { success: true, raw, httpStatus: res.status }
    : { success: false, error: "Vehicle update failed", raw, httpStatus: res.status };
}

export async function gspExtendValidity(
  ewayBillNo: string,
  opts: { sandbox: boolean; reason?: string },
): Promise<GspActionResult> {
  if (opts.sandbox || (process.env.EWAY_GSP_MODE?.trim() || "sandbox") === "sandbox") {
    return { success: true, validUpto: validUptoHours(8), raw: { extended: true, ewayBillNo }, httpStatus: 200 };
  }
  const baseUrl = process.env.EWAY_GSP_BASE_URL?.trim();
  if (!baseUrl) return { success: false, error: "GSP not configured", httpStatus: 503 };
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ewayBillNo, reason: opts.reason }),
  });
  const raw = await res.json().catch(() => ({}));
  return res.ok
    ? { success: true, validUpto: (raw as { validUpto?: string }).validUpto, raw, httpStatus: res.status }
    : { success: false, error: "Extension failed", raw, httpStatus: res.status };
}

export async function gspCancelEWayBill(
  ewayBillNo: string,
  reason: string,
  opts: { sandbox: boolean },
): Promise<GspActionResult> {
  if (opts.sandbox || (process.env.EWAY_GSP_MODE?.trim() || "sandbox") === "sandbox") {
    return { success: true, raw: { cancelled: true, ewayBillNo, reason }, httpStatus: 200 };
  }
  const baseUrl = process.env.EWAY_GSP_BASE_URL?.trim();
  if (!baseUrl) return { success: false, error: "GSP not configured", httpStatus: 503 };
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ewayBillNo, cancelReason: reason }),
  });
  const raw = await res.json().catch(() => ({}));
  return res.ok
    ? { success: true, raw, httpStatus: res.status }
    : { success: false, error: "Cancel failed", raw, httpStatus: res.status };
}

export function billToGspPayload(bill: EWayBill & { lines: EWayBillLine[] }): GspGeneratePayload {
  const modeMap = { ROAD: "1", RAIL: "2", AIR: "3", SHIP: "4" } as const;
  return {
    docNo: bill.sourceDocumentNumber,
    docDate: bill.sourceDocumentDate.toISOString().slice(0, 10),
    supplyType: bill.supplyType ?? "O",
    subSupplyType: bill.subSupplyType ?? undefined,
    fromGstin: bill.supplierGstin ?? undefined,
    toGstin: bill.recipientGstin ?? undefined,
    transporterGstin: bill.transporterGstin ?? undefined,
    vehicleNo: bill.vehicleNumber ?? undefined,
    transportMode: modeMap[bill.transportMode] ?? "1",
    distance: bill.distanceKm ?? 1,
    itemList: bill.lines.map((l) => ({
      productName: l.productName,
      hsnCode: l.hsnCode ?? "9999",
      quantity: Number(l.quantity),
      taxableAmount: Number(l.taxableValue),
      cgstRate: Number(l.cgstRate),
      sgstRate: Number(l.sgstRate),
      igstRate: Number(l.igstRate),
    })),
  };
}
