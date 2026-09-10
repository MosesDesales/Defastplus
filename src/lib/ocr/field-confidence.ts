import type { OcrExtractedDocument, OcrFieldConfidenceMap } from "@/lib/ocr/types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function scoreLabelledField(value: string | undefined, hasLabel: boolean, engineConfidence: number): number {
  if (!value?.trim()) return 0;
  let score = 0.55 + engineConfidence * 0.25;
  if (hasLabel) score += 0.15;
  if (value.length >= 3) score += 0.05;
  return clamp01(score);
}

export function scoreMoneyField(value: number | undefined, reconciled: boolean, engineConfidence: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  let score = 0.5 + engineConfidence * 0.2;
  if (reconciled) score += 0.2;
  return clamp01(score);
}

export function scoreGstinField(valid: boolean, hasLabel: boolean, engineConfidence: number): number {
  if (!valid) return hasLabel ? 0.35 : 0.2;
  return clamp01(0.75 + engineConfidence * 0.15 + (hasLabel ? 0.05 : 0));
}

export function buildFieldConfidence(
  doc: OcrExtractedDocument,
  engineConfidence: number,
  opts?: { gstinValid?: boolean; totalsReconciled?: boolean },
): OcrFieldConfidenceMap {
  const reconciled = opts?.totalsReconciled ?? !doc.meta?.validationNotes?.some((n) => n.includes("mismatch"));
  const gstinValid = opts?.gstinValid ?? Boolean(doc.partyGstin);

  return {
    partyName: scoreLabelledField(doc.partyName, true, engineConfidence),
    partyAddress: scoreLabelledField(doc.partyAddress, true, engineConfidence),
    partyGstin: doc.partyGstin ? scoreGstinField(gstinValid, true, engineConfidence) : 0,
    partyPan: scoreLabelledField(doc.partyPan, true, engineConfidence),
    invoiceNo: scoreLabelledField(doc.invoiceNo, true, engineConfidence),
    invoiceDate: doc.invoiceDate ? clamp01(0.65 + engineConfidence * 0.2) : 0,
    dueDate: doc.dueDate ? clamp01(0.6 + engineConfidence * 0.15) : 0,
    purchaseOrderNo: scoreLabelledField(doc.purchaseOrderNo, true, engineConfidence),
    ewayBillNo: scoreLabelledField(doc.ewayBillNo, true, engineConfidence),
    placeOfSupply: scoreLabelledField(doc.placeOfSupply, true, engineConfidence),
    taxableValue: scoreMoneyField(doc.taxableValue, reconciled, engineConfidence),
    subtotal: scoreMoneyField(doc.subtotal, reconciled, engineConfidence),
    discount: scoreMoneyField(doc.discount, true, engineConfidence),
    roundOff: doc.roundOff != null ? clamp01(0.55 + engineConfidence * 0.15) : 0,
    cgst: scoreMoneyField(doc.cgst, reconciled, engineConfidence),
    sgst: scoreMoneyField(doc.sgst, reconciled, engineConfidence),
    igst: scoreMoneyField(doc.igst, reconciled, engineConfidence),
    cess: scoreMoneyField(doc.cess, true, engineConfidence),
    totalTax: scoreMoneyField(doc.totalTax, reconciled, engineConfidence),
    total: scoreMoneyField(doc.total, reconciled, engineConfidence),
    amountPaid: scoreMoneyField(doc.amountPaid, true, engineConfidence),
    balanceDue: scoreMoneyField(doc.balanceDue, true, engineConfidence),
    items:
      doc.items.length > 0
        ? clamp01(doc.items.reduce((s, it) => s + (it.confidence ?? 0.6), 0) / doc.items.length)
        : 0,
  };
}

export function lowConfidenceFields(map: OcrFieldConfidenceMap, threshold = 0.55): string[] {
  return Object.entries(map)
    .filter(([, v]) => v != null && v > 0 && v < threshold)
    .map(([k]) => k);
}
