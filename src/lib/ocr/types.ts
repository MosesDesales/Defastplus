/** Stored on `OcrDocument.documentType` and sent from the client. */
export type OcrDocumentType = "INVOICE" | "BILL" | "EXPENSE";

/** Per-field confidence score (0–1). */
export type OcrFieldConfidenceMap = Partial<
  Record<
    | "partyName"
    | "partyAddress"
    | "partyGstin"
    | "partyPan"
    | "partyStateCode"
    | "partyPhone"
    | "partyEmail"
    | "invoiceNo"
    | "invoiceDate"
    | "dueDate"
    | "purchaseOrderNo"
    | "ewayBillNo"
    | "placeOfSupply"
    | "taxableValue"
    | "cgst"
    | "sgst"
    | "igst"
    | "cess"
    | "tcs"
    | "tds"
    | "totalTax"
    | "subtotal"
    | "discount"
    | "roundOff"
    | "total"
    | "amountPaid"
    | "balanceDue"
    | "items",
    number
  >
>;

export type OcrExtractedLineItem = {
  name: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discount?: number;
  taxPercent?: number;
  taxAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  amount?: number;
  /** Per-line confidence (0–1). */
  confidence?: number;
};

/** Fields the UI may highlight after validation / reconciliation. */
export type OcrFieldHighlight =
  | "total"
  | "subtotal"
  | "invoiceDate"
  | "partyGstin"
  | "items"
  | "tax"
  | "taxableValue"
  | "roundOff";

/** Normalized extraction used by forms and the preview UI. */
export type OcrExtractedDocument = {
  partyName?: string;
  partyAddress?: string;
  partyGstin?: string;
  partyPan?: string;
  partyStateCode?: string;
  partyPhone?: string;
  partyEmail?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  dueDate?: string;
  purchaseOrderNo?: string;
  ewayBillNo?: string;
  placeOfSupply?: string;
  items: OcrExtractedLineItem[];
  taxableValue?: number;
  subtotal?: number;
  discount?: number;
  roundOff?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  tcs?: number;
  tds?: number;
  totalTax?: number;
  total?: number;
  amountPaid?: number;
  balanceDue?: number;
  /** Derived from company GSTIN vs party GSTIN when both present. */
  supplyIsInterState?: boolean;
  /** 0–1 overall confidence hint (engine + parsing). */
  confidence?: number;
  /** Per-field confidence for review UI. */
  fieldConfidence?: OcrFieldConfidenceMap;
  warnings: string[];
  meta?: {
    duplicateInvoiceId?: string | null;
    duplicateBillNumber?: string | null;
    duplicateExpenseKey?: string | null;
    ocrEngine?: string;
    parseMode?: "openai" | "heuristic" | "indian_gst" | "vendor_template";
    vendorTemplateId?: string | null;
    preprocessSteps?: string[];
    pageCount?: number;
    highlightFields?: OcrFieldHighlight[];
    validationNotes?: string[];
    auditLog?: OcrAuditEntry[];
  };
};

export type OcrAuditEntry = {
  at: string;
  stage: string;
  message: string;
  detail?: string;
};

export const OCR_MAX_BYTES = 20 * 1024 * 1024;

export const OCR_ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png"] as const;

export function isAllowedOcrMime(mime: string): boolean {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return (OCR_ALLOWED_MIMES as readonly string[]).includes(m);
}
