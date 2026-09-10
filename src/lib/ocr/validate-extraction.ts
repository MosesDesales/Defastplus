import type { OcrExtractedDocument, OcrFieldHighlight } from "@/lib/ocr/types";
import { applyGstValidations } from "@/lib/ocr/gst-validation";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reconcile totals with line items and footer subtotal + tax when OCR disagrees.
 */
export function validateAndReconcileExtraction(doc: OcrExtractedDocument): OcrExtractedDocument {
  const warnings = [...doc.warnings];
  const highlightFields = new Set<OcrFieldHighlight>(doc.meta?.highlightFields ?? []);
  const validationNotes = [...(doc.meta?.validationNotes ?? [])];

  const sumLineAmounts = round2(
    doc.items.reduce((s, it) => {
      const v = it.amount ?? it.rate * it.qty;
      return s + (Number.isFinite(v) ? v : 0);
    }, 0),
  );

  const taxSum = round2((doc.cgst ?? 0) + (doc.sgst ?? 0) + (doc.igst ?? 0) + (doc.cess ?? 0));
  let fromFooter: number | undefined;
  if (doc.subtotal != null && taxSum > 0) {
    fromFooter = round2(doc.subtotal - (doc.discount ?? 0) + taxSum + (doc.roundOff ?? 0));
  }

  let nextTotal = doc.total;

  const toleranceFor = (base: number) => Math.max(1, 0.02 * Math.max(base, 1));

  const declaredTotal = doc.total;
  const referenceTotal =
    declaredTotal != null && fromFooter != null
      ? Math.abs(declaredTotal - fromFooter) <= toleranceFor(Math.max(declaredTotal, fromFooter))
        ? declaredTotal
        : declaredTotal
      : (declaredTotal ?? fromFooter);

  if (sumLineAmounts > 0 && referenceTotal != null) {
    const driftFromRef = Math.abs(referenceTotal - sumLineAmounts);
    const refTol = toleranceFor(Math.max(referenceTotal, sumLineAmounts));
    if (driftFromRef > refTol) {
      const ratio = sumLineAmounts / referenceTotal;
      if (ratio > 1.5 || ratio < 0.67) {
        nextTotal = round2(referenceTotal);
        warnings.push("Total did not match line items — kept amount from invoice total / subtotal + tax.");
        highlightFields.add("total");
        validationNotes.push("total_kept_from_footer");
      }
    }
  }

  if (sumLineAmounts > 0 && nextTotal != null) {
    const t = nextTotal;
    const drift = Math.abs(t - sumLineAmounts);
    const tol = toleranceFor(Math.max(t, sumLineAmounts));
    if (drift > tol && validationNotes.includes("total_kept_from_footer") === false) {
      if (fromFooter != null && Math.abs(fromFooter - sumLineAmounts) < drift) {
        nextTotal = fromFooter;
        warnings.push("Total adjusted to subtotal + tax from the document.");
        highlightFields.add("total");
        validationNotes.push("total_reconciled_subtotal_tax");
      } else if (referenceTotal == null || Math.abs(sumLineAmounts - referenceTotal) <= tol * 2) {
        nextTotal = sumLineAmounts;
        warnings.push("Total did not match sum of line items — reconciled to line sum.");
        highlightFields.add("total");
        validationNotes.push("total_reconciled_line_sum");
      }
    }
  } else if (sumLineAmounts > 0 && nextTotal == null) {
    nextTotal = sumLineAmounts;
  }

  if (fromFooter != null && nextTotal != null && !validationNotes.includes("total_kept_from_footer")) {
    const drift = Math.abs(fromFooter - nextTotal);
    const tol = toleranceFor(Math.max(fromFooter, nextTotal));
    if (drift > tol && doc.subtotal != null && taxSum > 0) {
      nextTotal = fromFooter;
      warnings.push("Total adjusted to subtotal + tax from the document.");
      highlightFields.add("total");
      validationNotes.push("total_reconciled_subtotal_tax");
    }
  }

  if (nextTotal == null && fromFooter != null) {
    nextTotal = fromFooter;
  }

  return applyGstValidations({
    ...doc,
    total: nextTotal,
    totalTax: doc.totalTax ?? (taxSum > 0 ? taxSum : undefined),
    warnings: [...new Set(warnings)],
    meta: {
      ...doc.meta,
      highlightFields: highlightFields.size ? [...highlightFields] : undefined,
      validationNotes: validationNotes.length ? validationNotes : undefined,
    },
  });
}
