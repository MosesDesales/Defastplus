/** Slugs stored in `DocumentTemplate.type`, URLs, and `template_module_map.moduleName`. */
export const DOCUMENT_TEMPLATE_TYPES = [
  "quotes",
  "sales-orders",
  "delivery-challans",
  "invoices",
  "credit-notes",
  "purchase-orders",
  "payment-receipts",
  "checks",
  "customer-statements",
  "bills",
  "vendor-credits",
  "vendor-payments",
  "vendor-statements",
  "journals",
] as const;

export type DocumentTemplateTypeSlug = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export type TemplateColumnKey =
  | "item"
  | "description"
  | "qty"
  | "rate"
  | "tax"
  | "amount";

export type DocumentTemplateConfig = {
  version: 1;
  sectionOrder?: string[];
  header: {
    showLogo: boolean;
    showCompanyName: boolean;
    showAddress: boolean;
    showGstin: boolean;
    alignment: "left" | "center" | "right";
    fontSizePt: number;
  };
  documentInfo: {
    showNumber: boolean;
    showIssueDate: boolean;
    showDueDate: boolean;
  };
  party: {
    show: boolean;
    label: string;
  };
  columns: TemplateColumnKey[];
  summary: {
    showSubtotal: boolean;
    showGstSplit: boolean;
    showTotal: boolean;
  };
  footer: {
    showNotes: boolean;
    showTerms: boolean;
    showSignature: boolean;
    notes: string;
    terms: string;
    signatureLabel: string;
  };
  typography: {
    bodyFontSizePt: number;
    headingFont: string;
    bodyFont: string;
  };
  colors: {
    primary: string;
    headerBg: string;
    tableHeaderBg: string;
    tableBorder: string;
  };
  customFields: { id: string; label: string; value: string }[];
};

export const DEFAULT_DOCUMENT_TEMPLATE_CONFIG: DocumentTemplateConfig = {
  version: 1,
  sectionOrder: ["header", "documentInfo", "party", "items", "summary", "footer"],
  header: {
    showLogo: true,
    showCompanyName: true,
    showAddress: true,
    showGstin: true,
    alignment: "left",
    fontSizePt: 11,
  },
  documentInfo: {
    showNumber: true,
    showIssueDate: true,
    showDueDate: true,
  },
  party: {
    show: true,
    label: "Bill To",
  },
  columns: ["item", "description", "qty", "rate", "tax", "amount"],
  summary: {
    showSubtotal: true,
    showGstSplit: true,
    showTotal: true,
  },
  footer: {
    showNotes: true,
    showTerms: true,
    showSignature: true,
    notes: "",
    terms: "Payment is due within the agreed credit period.",
    signatureLabel: "Authorized Signatory",
  },
  typography: {
    bodyFontSizePt: 9,
    headingFont: "Helvetica-Bold",
    bodyFont: "Helvetica",
  },
  colors: {
    primary: "#0f766e",
    headerBg: "#f0fdfa",
    tableHeaderBg: "#ccfbf1",
    tableBorder: "#99f6e4",
  },
  customFields: [],
};

export function isDocumentTemplateTypeSlug(s: string): s is DocumentTemplateTypeSlug {
  return (DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(s);
}

export function parseTemplateConfigJson(raw: string): DocumentTemplateConfig {
  try {
    const v = JSON.parse(raw) as Partial<DocumentTemplateConfig>;
    if (!v || v.version !== 1) {
      return { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG };
    }
    return {
      ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
      ...v,
      header: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.header, ...v.header },
      documentInfo: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.documentInfo, ...v.documentInfo },
      party: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.party, ...v.party },
      summary: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.summary, ...v.summary },
      footer: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.footer, ...v.footer },
      typography: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.typography, ...v.typography },
      colors: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.colors, ...v.colors },
      columns: Array.isArray(v.columns) && v.columns.length ? (v.columns as TemplateColumnKey[]) : DEFAULT_DOCUMENT_TEMPLATE_CONFIG.columns,
      customFields: Array.isArray(v.customFields) ? v.customFields : [],
      sectionOrder: Array.isArray(v.sectionOrder) ? v.sectionOrder : DEFAULT_DOCUMENT_TEMPLATE_CONFIG.sectionOrder,
    };
  } catch {
    return { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG };
  }
}

export function templateTypeLabel(slug: DocumentTemplateTypeSlug): string {
  const map: Record<DocumentTemplateTypeSlug, string> = {
    quotes: "Quotes",
    "sales-orders": "Sales Orders",
    "delivery-challans": "Delivery Challans",
    invoices: "Invoices",
    "credit-notes": "Credit Notes",
    "purchase-orders": "Purchase Orders",
    "payment-receipts": "Payment Receipts",
    checks: "Checks",
    "customer-statements": "Customer Statements",
    bills: "Bills",
    "vendor-credits": "Vendor Credits",
    "vendor-payments": "Vendor Payments",
    "vendor-statements": "Vendor Statements",
    journals: "Journals",
  };
  return map[slug] ?? slug;
}

/** Uppercase document title shown in PDF / preview for a module. */
export function documentTitleForModule(type: DocumentTemplateTypeSlug): string {
  const m: Record<DocumentTemplateTypeSlug, string> = {
    quotes: "QUOTE",
    "sales-orders": "SALES ORDER",
    "delivery-challans": "DELIVERY CHALLAN",
    invoices: "TAX INVOICE",
    "credit-notes": "CREDIT NOTE",
    "purchase-orders": "PURCHASE ORDER",
    "payment-receipts": "PAYMENT RECEIPT",
    checks: "CHECK",
    "customer-statements": "CUSTOMER STATEMENT",
    bills: "BILL",
    "vendor-credits": "VENDOR CREDIT",
    "vendor-payments": "VENDOR PAYMENT",
    "vendor-statements": "VENDOR STATEMENT",
    journals: "JOURNAL VOUCHER",
  };
  return m[type] ?? "DOCUMENT";
}
