import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { isIndianGstin15 } from "@/lib/ocr/gstin-detect";
import type { OcrExtractedDocument, OcrFieldHighlight } from "@/lib/ocr/types";

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Official GSTIN checksum (15th character). */
export function validateGstinChecksum(gstin: string): boolean {
  const g = normalizeGstin(gstin);
  if (g.length !== 15) return false;
  if (!isIndianGstin15(g)) return false;

  let sum = 0;
  let factor = 1;
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CHARS.indexOf(g[i]!);
    if (codePoint < 0) return false;
    let addend = factor * codePoint;
    factor = factor === 1 ? 2 : 1;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  const check = (36 - (sum % 36)) % 36;
  return GSTIN_CHARS[check] === g[14];
}

export function validateGstinFull(gstin: string): { valid: boolean; message?: string } {
  const g = normalizeGstin(gstin);
  if (!g) return { valid: true };
  if (g.length !== 15) return { valid: false, message: "GSTIN must be 15 characters." };
  if (!isValidGstin(g)) return { valid: false, message: "GSTIN format is invalid." };
  if (!validateGstinChecksum(g)) return { valid: false, message: "GSTIN checksum failed — verify the number." };
  return { valid: true };
}

export function validateInvoiceDateYmd(ymd?: string): { valid: boolean; message?: string } {
  if (!ymd) return { valid: true };
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { valid: false, message: "Invoice date must be YYYY-MM-DD." };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return { valid: false, message: "Invoice date is not a valid calendar date." };
  }
  const now = new Date();
  const maxFuture = new Date(now);
  maxFuture.setUTCDate(maxFuture.getUTCDate() + 7);
  if (dt > maxFuture) return { valid: false, message: "Invoice date is too far in the future." };
  if (y < 2000) return { valid: false, message: "Invoice date year looks incorrect." };
  return { valid: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateIndianTaxSplit(doc: OcrExtractedDocument): string[] {
  const warnings: string[] = [];
  const cgst = doc.cgst ?? 0;
  const sgst = doc.sgst ?? 0;
  const igst = doc.igst ?? 0;

  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    warnings.push("Both IGST and CGST/SGST appear on the same invoice — verify tax split.");
  }

  if (cgst > 0 && sgst > 0 && Math.abs(cgst - sgst) > 0.05) {
    warnings.push(`CGST (${cgst}) and SGST (${sgst}) should usually be equal for intra-state supply.`);
  }

  const totalTax = doc.totalTax ?? round2(cgst + sgst + igst + (doc.cess ?? 0));
  if (doc.totalTax != null && Math.abs(totalTax - round2(cgst + sgst + igst + (doc.cess ?? 0))) > 0.05) {
    warnings.push("Total tax does not equal CGST + SGST + IGST + CESS.");
  }

  if (doc.taxableValue != null && doc.subtotal != null && Math.abs(doc.taxableValue - doc.subtotal) > 1) {
    warnings.push("Taxable value differs from subtotal — confirm which is correct.");
  }

  return warnings;
}

export function validateAmounts(doc: OcrExtractedDocument): {
  warnings: string[];
  highlightFields: OcrFieldHighlight[];
  notes: string[];
} {
  const warnings: string[] = [];
  const highlightFields = new Set<OcrFieldHighlight>();
  const notes: string[] = [];

  const sumLines = round2(
    doc.items.reduce((s, it) => s + (it.amount ?? it.rate * it.qty), 0),
  );

  const taxSum = round2((doc.cgst ?? 0) + (doc.sgst ?? 0) + (doc.igst ?? 0) + (doc.cess ?? 0));
  const fromFooter =
    doc.subtotal != null && taxSum > 0
      ? round2(doc.subtotal - (doc.discount ?? 0) + taxSum + (doc.roundOff ?? 0))
      : undefined;

  if (doc.total != null && sumLines > 0) {
    const drift = Math.abs(doc.total - sumLines);
    const tol = Math.max(1, 0.02 * doc.total);
    if (drift > tol) {
      warnings.push(`Grand total (${doc.total}) differs from line sum (${sumLines}).`);
      highlightFields.add("total");
      notes.push("total_line_mismatch");
    }
  }

  if (doc.total != null && fromFooter != null) {
    const drift = Math.abs(doc.total - fromFooter);
    if (drift > Math.max(1, 0.02 * doc.total)) {
      warnings.push(`Grand total (${doc.total}) differs from subtotal + tax (${fromFooter}).`);
      highlightFields.add("total");
      notes.push("total_footer_mismatch");
    }
  }

  return { warnings, highlightFields: [...highlightFields], notes };
}

/** Run all GST / amount validations and merge into document. */
export function applyGstValidations(doc: OcrExtractedDocument): OcrExtractedDocument {
  const warnings = [...doc.warnings];
  const highlightFields = new Set<OcrFieldHighlight>(doc.meta?.highlightFields ?? []);
  const validationNotes = [...(doc.meta?.validationNotes ?? [])];

  if (doc.partyGstin && isIndianGstin15(doc.partyGstin)) {
    const gv = validateGstinFull(doc.partyGstin);
    if (!gv.valid) {
      warnings.push(gv.message ?? "Invalid GSTIN.");
      highlightFields.add("partyGstin");
      validationNotes.push("gstin_invalid");
    }
  }

  const dv = validateInvoiceDateYmd(doc.invoiceDate);
  if (!dv.valid) {
    warnings.push(dv.message ?? "Invalid invoice date.");
    highlightFields.add("invoiceDate");
    validationNotes.push("date_invalid");
  }

  for (const w of validateIndianTaxSplit(doc)) warnings.push(w);

  const amt = validateAmounts(doc);
  for (const w of amt.warnings) warnings.push(w);
  for (const h of amt.highlightFields) highlightFields.add(h);
  for (const n of amt.notes) validationNotes.push(n);

  return {
    ...doc,
    warnings: [...new Set(warnings)],
    meta: {
      ...doc.meta,
      highlightFields: highlightFields.size ? [...highlightFields] : undefined,
      validationNotes: validationNotes.length ? validationNotes : undefined,
    },
  };
}
