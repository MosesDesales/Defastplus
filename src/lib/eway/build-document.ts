import type { EWayBillDocumentType } from "@prisma/client";
import type { CompanyProfile } from "@prisma/client";
import { isInterState } from "@/lib/gst/split";
import { formatAddress, resolveNumericStateCode, stateNameFromCode } from "@/lib/eway/state-codes";
import { normalizeHsn, normalizePincode } from "@/lib/eway/validation";

export type EWayLineDraft = {
  productName: string;
  hsnCode: string | null;
  quantity: number;
  unit: string;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
};

export type EWayDraftPayload = {
  documentType: EWayBillDocumentType;
  sourceDocumentNumber: string;
  sourceDocumentDate: Date;
  documentValue: number;
  supplierName: string;
  supplierGstin: string | null;
  supplierAddress: string;
  supplierStateCode: string | null;
  supplierPincode: string | null;
  customerId?: string | null;
  recipientName: string;
  recipientGstin: string | null;
  recipientAddress: string;
  recipientStateCode: string | null;
  recipientPincode: string | null;
  placeOfSupply: string | null;
  supplyType: "O" | "I";
  subSupplyType?: string | null;
  lines: EWayLineDraft[];
  automation: { suggested: boolean; reasons: string[] };
};

type TaxLine = {
  description: string;
  quantity: unknown;
  taxPercent: unknown;
  lineNet: unknown;
  item?: { hsnCode?: string | null; unit?: string } | null;
};

export function supplierFromProfile(profile: CompanyProfile | null) {
  return {
    supplierName: profile?.companyName ?? "Supplier",
    supplierGstin: profile?.gstin ?? null,
    supplierAddress: formatAddress([
      profile?.billingStreet,
      profile?.billingStreet2,
      profile?.billingCity,
      profile?.billingState,
      profile?.billingZip,
    ]),
    supplierStateCode: resolveNumericStateCode({
      gstin: profile?.gstin,
      stateNameOrCode: profile?.billingState,
    }),
    supplierPincode: normalizePincode(profile?.billingZip),
  };
}

export function recipientFromCustomer(customer: {
  displayName: string;
  gstin: string | null;
  billingStreet: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
}) {
  const recipientStateCode = resolveNumericStateCode({
    gstin: customer.gstin,
    stateNameOrCode: customer.billingState,
  });
  return {
    recipientName: customer.displayName,
    recipientGstin: customer.gstin,
    recipientAddress: formatAddress([
      customer.billingStreet,
      customer.billingCity,
      customer.billingState,
      customer.billingZip,
    ]),
    recipientStateCode,
    recipientPincode: normalizePincode(customer.billingZip),
    placeOfSupply: stateNameFromCode(recipientStateCode) ?? customer.billingState,
  };
}

export function recipientFromVendor(vendor: {
  displayName: string;
  companyName?: string | null;
  gstin: string | null;
  billingStreet: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
}) {
  const recipientStateCode = resolveNumericStateCode({
    gstin: vendor.gstin,
    stateNameOrCode: vendor.billingState,
  });
  const name = vendor.companyName?.trim() || vendor.displayName;
  return {
    recipientName: name,
    recipientGstin: vendor.gstin,
    recipientAddress: formatAddress([
      vendor.billingStreet,
      vendor.billingCity,
      vendor.billingState,
      vendor.billingZip,
    ]),
    recipientStateCode,
    recipientPincode: normalizePincode(vendor.billingZip),
    placeOfSupply: stateNameFromCode(recipientStateCode) ?? vendor.billingState,
  };
}

export function mapTaxLinesToEWayLines(lines: TaxLine[], inter: boolean): EWayLineDraft[] {
  return lines.map((line) => {
    const taxPct = Number(line.taxPercent);
    const half = inter ? 0 : taxPct / 2;
    return {
      productName: line.description,
      hsnCode: normalizeHsn(line.item?.hsnCode),
      quantity: Number(line.quantity),
      unit: line.item?.unit ?? "NOS",
      taxableValue: Number(line.lineNet),
      cgstRate: inter ? 0 : half,
      sgstRate: inter ? 0 : half,
      igstRate: inter ? taxPct : 0,
    };
  });
}

export function buildAutomationReasons(opts: {
  documentValue: number;
  threshold: number;
  inter: boolean;
  autoSuggestOverThreshold?: boolean;
  autoSuggestInterstate?: boolean;
  extraReasons?: string[];
}) {
  const reasons: string[] = [...(opts.extraReasons ?? [])];
  if (opts.autoSuggestOverThreshold !== false && opts.documentValue >= opts.threshold) {
    reasons.push(`Document value Rs ${opts.documentValue.toLocaleString("en-IN")} exceeds threshold Rs ${opts.threshold.toLocaleString("en-IN")}.`);
  }
  if (opts.autoSuggestInterstate !== false && opts.inter) {
    reasons.push("Inter-state movement detected — E-Way Bill is typically required.");
  }
  return { suggested: reasons.length > 0, reasons };
}

export function supplyTypeForParties(companyGstin: string | null | undefined, otherGstin: string | null | undefined) {
  return isInterState(companyGstin, otherGstin) ? ("I" as const) : ("O" as const);
}
