import type { OcrExtractedDocument } from "@/lib/ocr/types";

/** Safe to import from Client Components — no Node / pdf-parse dependencies. */
export function lowConfidenceWarning(doc: OcrExtractedDocument): string | null {
  const c = doc.confidence ?? 0;
  if (c < 0.45) return "Low OCR confidence — please verify every field against the original document.";
  if (c < 0.6) return "Moderate OCR confidence — double-check amounts and GST before saving.";
  return null;
}
