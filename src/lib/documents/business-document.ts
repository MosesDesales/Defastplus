/**
 * Normalised, render-agnostic model of a business document (invoice, quote, credit note,
 * bill, expense voucher). The PDF renderer and the on-screen preview both consume this, so
 * the two always show the same content. Pure — no Prisma client or PDF code here.
 */
import type {
  CompanyProfile,
  CreditNote,
  CreditNoteLine,
  Customer,
  Invoice,
  InvoiceLine,
  Quote,
  QuoteLine,
  Vendor,
  VendorBill,
  VendorBillLine,
} from "@prisma/client";
import { amountInWords } from "@/lib/amount-in-words";
import { DEFAULT_DOCUMENT_TEMPLATE_CONFIG, type DocumentTemplateConfig } from "@/lib/document-template-types";
import { resolveNumericStateCode, stateNameFromCode } from "@/lib/eway/state-codes";
import { invoiceSummaryViewFromStored } from "@/lib/sales/invoice-document-summary";

export type TaxMode = "split" | "igst" | "mixed" | "none";

export type DocCompany = {
  name: string;
  legalName: string | null;
  addressLines: string[];
  gstin: string | null;
  pan: string | null;
  contact: string | null;
  logoUrl: string | null;
};

export type DocTextLine = { text: string; tone?: "strong" | "muted" | "emphasis" };
export type DocParty = { label: string; name: string; lines: DocTextLine[] };

export type DocLine = {
  description: string;
  hsn: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  taxable: number;
  taxPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  amount: number;
};

export type DocColumns = { hsn: boolean; qty: boolean; rate: boolean; taxable: boolean; tax: boolean; amount: boolean };
export type DocTotalRow = { label: string; value: number; sign?: "minus" | "plus" };
export type DocGstRow = { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number };
export type DocBank = { accountName: string | null; bankName: string | null; accountNumber: string; ifsc: string | null; branch: string | null; upi: string | null };
export type DocTheme = { primary: string; soft: string; tableHead: string; tableBorder: string };

export type BusinessDocument = {
  kind: "invoice" | "quote" | "credit-note" | "bill" | "expense";
  title: string;
  copyLabel: string | null;
  number: string;
  currency: string;
  company: DocCompany;
  party: DocParty | null;
  detailsTitle: string;
  details: [string, string][];
  lines: DocLine[];
  columns: DocColumns;
  taxMode: TaxMode;
  totals: DocTotalRow[];
  total: { label: string; value: number } | null;
  headline: { label: string; value: number } | null;
  amountInWords: string | null;
  gstSummary: DocGstRow[] | null;
  gstSummaryNote: string | null;
  notes: { title: string; body: string }[];
  bank: DocBank | null;
  signature: { forLabel: string; label: string } | null;
  footerNote: string;
  watermark: string | null;
  theme: DocTheme;
  /** Base body font size in points (template typography). */
  baseSize: number;
  headerSize: number;
  showLogo: boolean;
};

export type CompanyForDocs = Pick<
  CompanyProfile,
  "companyName" | "gstin" | "billingStreet" | "billingCity" | "billingState" | "billingZip" | "billingCountry" | "logoUrl"
> &
  Partial<
    Pick<
      CompanyProfile,
      | "billingStreet2"
      | "pan"
      | "phone"
      | "websiteUrl"
      | "contactEmail"
      | "gstBusinessLegalName"
      | "bankAccountName"
      | "bankName"
      | "bankAccountNumber"
      | "bankIfsc"
      | "bankBranch"
      | "bankUpiId"
    >
  >;

// ── Shared helpers ────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (d: { toString(): string } | number | null | undefined) => (d == null ? 0 : Number(d.toString()));

export const fmtDocDate = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

export const PAYMENT_TERMS: Record<string, string> = {
  DUE_ON_RECEIPT: "Due on receipt",
  NET_15: "Net 15",
  NET_30: "Net 30",
  NET_45: "Net 45",
  NET_60: "Net 60",
};

function countryName(code: string | null | undefined) {
  if (!code) return "";
  return code.toUpperCase() === "IN" ? "India" : code;
}

export function stateWithCode(state: string | null | undefined, gstin?: string | null): string {
  const code = resolveNumericStateCode({ gstin, stateNameOrCode: state });
  const name = state?.trim() || stateNameFromCode(code) || "";
  if (!name && !code) return "";
  return code ? `${name || stateNameFromCode(code)} (${code})` : name;
}

const joinNonEmpty = (parts: (string | null | undefined)[], sep: string) => parts.filter((s) => s?.trim()).join(sep);

export function docCompany(company: CompanyForDocs | null): DocCompany {
  const c = company;
  const name = c?.companyName?.trim() || "Company";
  const legal = c?.gstBusinessLegalName?.trim() || null;
  return {
    name,
    legalName: legal && legal.toLowerCase() !== name.toLowerCase() ? legal : null,
    addressLines: c
      ? [
          joinNonEmpty([c.billingStreet, c.billingStreet2], ", "),
          joinNonEmpty([c.billingCity, joinNonEmpty([c.billingState, c.billingZip], " "), countryName(c.billingCountry)], ", "),
        ].filter(Boolean)
      : [],
    gstin: c?.gstin?.trim() || null,
    pan: c?.pan?.trim() || null,
    contact: joinNonEmpty([c?.phone, c?.contactEmail, c?.websiteUrl], "  ·  ") || null,
    logoUrl: c?.logoUrl?.trim() || null,
  };
}

function docBank(company: CompanyForDocs | null): DocBank | null {
  const acct = company?.bankAccountNumber?.trim();
  if (!acct) return null;
  return {
    accountName: company?.bankAccountName?.trim() || null,
    bankName: company?.bankName?.trim() || null,
    accountNumber: acct,
    ifsc: company?.bankIfsc?.trim() || null,
    branch: company?.bankBranch?.trim() || null,
    upi: company?.bankUpiId?.trim() || null,
  };
}

type PartyLike = Pick<
  Customer,
  "displayName" | "companyName" | "billingAttention" | "billingStreet" | "billingCity" | "billingState" | "billingZip" | "billingCountry" | "gstin" | "email" | "mobile" | "workPhone"
>;

function docParty(label: string, p: PartyLike & { pan?: string | null }): DocParty {
  const lines: DocTextLine[] = [];
  const secondary = joinNonEmpty([p.billingAttention, p.companyName && p.companyName !== p.displayName ? p.companyName : null], " · ");
  if (secondary) lines.push({ text: secondary, tone: "muted" });
  const addr = joinNonEmpty([p.billingStreet, p.billingCity, joinNonEmpty([p.billingState, p.billingZip], " "), countryName(p.billingCountry)], ", ");
  if (addr) lines.push({ text: addr });
  if (p.gstin) lines.push({ text: `GSTIN  ${p.gstin}`, tone: "strong" });
  if (p.pan) lines.push({ text: `PAN  ${p.pan}` });
  const st = stateWithCode(p.billingState, p.gstin);
  if (st) lines.push({ text: `State  ${st}` });
  const reach = joinNonEmpty([p.email, p.mobile || p.workPhone], "  ·  ");
  if (reach) lines.push({ text: reach, tone: "muted" });
  return { label, name: p.displayName, lines };
}

export function taxModeOf(lines: Pick<DocLine, "cgst" | "sgst" | "igst" | "tax">[]): TaxMode {
  const intra = lines.some((l) => l.cgst !== 0 || l.sgst !== 0);
  const inter = lines.some((l) => l.igst !== 0);
  if (intra && inter) return "mixed";
  if (intra) return "split";
  if (inter) return "igst";
  return lines.some((l) => l.tax !== 0) ? "mixed" : "none";
}

function gstSummaryOf(lines: DocLine[]): DocGstRow[] {
  const by = new Map<number, DocGstRow>();
  for (const l of lines) {
    const g = by.get(l.taxPercent) ?? { rate: l.taxPercent, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    g.taxable += l.taxable;
    g.cgst += l.cgst;
    g.sgst += l.sgst;
    g.igst += l.igst;
    g.tax += l.tax;
    by.set(l.taxPercent, g);
  }
  return [...by.values()].sort((a, b) => a.rate - b.rate);
}

/** GST rows for the totals card, scaled by `factor` (invoice-level discount) so they reconcile. */
function gstTotalRows(lines: DocLine[], mode: TaxMode, factor: number, taxTotal: number): DocTotalRow[] {
  if (taxTotal === 0) return [];
  if (mode === "mixed" || mode === "none") return [{ label: "GST", value: taxTotal }];
  const igst = round2(lines.reduce((s, l) => s + l.igst, 0) * factor);
  const cgst = round2(lines.reduce((s, l) => s + l.cgst, 0) * factor);
  const sgst = round2(taxTotal - cgst - igst);
  return [
    ...(cgst ? [{ label: "CGST", value: cgst }] : []),
    ...(sgst ? [{ label: "SGST", value: sgst }] : []),
    ...(igst ? [{ label: "IGST", value: igst }] : []),
  ];
}

function themeOf(cfg: DocumentTemplateConfig): DocTheme {
  return { primary: cfg.colors.primary, soft: cfg.colors.headerBg, tableHead: cfg.colors.tableHeaderBg, tableBorder: cfg.colors.tableBorder };
}

function columnsOf(cfg: DocumentTemplateConfig, lines: DocLine[], opts: { tax: boolean }): DocColumns {
  const want = new Set(cfg.columns);
  return {
    hsn: lines.some((l) => l.hsn?.trim()),
    qty: want.has("qty"),
    rate: want.has("rate"),
    taxable: opts.tax,
    tax: opts.tax && want.has("tax"),
    amount: true,
  };
}

type GstLineRow = Pick<InvoiceLine, "description" | "quantity" | "rate" | "taxPercent" | "lineNet" | "lineTax" | "lineTotal" | "lineCgst" | "lineSgst" | "lineIgst"> & {
  item?: { hsnCode: string | null; unit: string } | null;
};

function gstLine(l: GstLineRow): DocLine {
  return {
    description: l.description,
    hsn: l.item?.hsnCode?.trim() || null,
    qty: num(l.quantity),
    unit: l.item?.unit && l.item.unit !== "unit" ? l.item.unit : null,
    rate: num(l.rate),
    taxable: num(l.lineNet),
    taxPercent: num(l.taxPercent),
    cgst: num(l.lineCgst),
    sgst: num(l.lineSgst),
    igst: num(l.lineIgst),
    tax: num(l.lineTax),
    amount: num(l.lineTotal),
  };
}

function baseDoc(cfg: DocumentTemplateConfig, company: CompanyForDocs | null) {
  return {
    company: docCompany(company),
    theme: themeOf(cfg),
    baseSize: Math.min(11, Math.max(7.5, cfg.typography.bodyFontSizePt || 9)),
    headerSize: cfg.header.fontSizePt || 11,
    showLogo: cfg.header.showLogo !== false,
  };
}

function footerNotes(cfg: DocumentTemplateConfig | null, extra: { title: string; body: string | null | undefined }[] = []) {
  const out: { title: string; body: string }[] = [];
  for (const e of extra) if (e.body?.trim()) out.push({ title: e.title, body: e.body.trim() });
  const f = cfg?.footer;
  if (f && f.showNotes !== false && f.notes?.trim() && !out.some((o) => o.title === "Notes")) out.push({ title: "Notes", body: f.notes.trim() });
  if (f && f.showTerms !== false && f.terms?.trim() && !out.some((o) => o.title === "Terms & Conditions")) out.push({ title: "Terms & Conditions", body: f.terms.trim() });
  return out;
}

function signatureOf(cfg: DocumentTemplateConfig | null, companyName: string) {
  const f = cfg?.footer ?? DEFAULT_DOCUMENT_TEMPLATE_CONFIG.footer;
  if (f.showSignature === false) return null;
  return { forLabel: `For ${companyName}`, label: (f.signatureLabel || "Authorised Signatory").trim() };
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export type InvoiceForDoc = Invoice & { lines: GstLineRow[]; customer: Customer };

export function invoiceToDocument(inv: InvoiceForDoc, company: CompanyForDocs | null, template: DocumentTemplateConfig | null): BusinessDocument {
  const cfg = template ?? DEFAULT_DOCUMENT_TEMPLATE_CONFIG;
  const sv = invoiceSummaryViewFromStored(inv);
  const lines = inv.lines.map(gstLine);
  const mode = taxModeOf(lines);
  const cust = inv.customer;
  const factor = sv.lineNetSum > 0 ? sv.netAfterDiscount / sv.lineNetSum : 0;

  const details: [string, string][] = [];
  if (cfg.documentInfo.showNumber !== false) details.push(["Invoice No.", inv.invoiceNumber]);
  if (cfg.documentInfo.showIssueDate !== false) details.push(["Invoice Date", fmtDocDate(inv.issueDate)]);
  if (cfg.documentInfo.showDueDate !== false && inv.dueDate) details.push(["Due Date", fmtDocDate(inv.dueDate)]);
  if (PAYMENT_TERMS[cust.paymentTerms]) details.push(["Payment Terms", PAYMENT_TERMS[cust.paymentTerms]!]);
  if (inv.reference?.trim()) details.push(["Reference", inv.reference.trim()]);
  const pos = stateWithCode(cust.billingState, cust.gstin);
  if (pos) details.push(["Place of Supply", pos]);
  if (inv.currency.toUpperCase() !== "INR") {
    details.push(["Currency", inv.currency.toUpperCase()]);
    if (inv.exchangeRate) details.push(["Exchange Rate", `1 ${inv.currency.toUpperCase()} = ₹ ${num(inv.exchangeRate)}`]);
  }
  for (const f of cfg.customFields) if (f.label?.trim() && f.value?.trim()) details.push([f.label.trim(), f.value.trim()]);

  const totals: DocTotalRow[] = [];
  if (cfg.summary.showSubtotal !== false) totals.push({ label: "Taxable value", value: sv.lineNetSum });
  if (sv.discountAmount > 0) totals.push({ label: `Discount (${sv.discountPercent}%)`, value: sv.discountAmount, sign: "minus" });
  if (cfg.summary.showGstSplit !== false) totals.push(...gstTotalRows(lines, mode, factor, sv.taxAfterDiscount));
  else if (sv.taxAfterDiscount) totals.push({ label: "Tax", value: sv.taxAfterDiscount });
  if (sv.withholdingType !== "NONE" && sv.withholdingAmount > 0) {
    totals.push({ label: `${sv.withholdingType} (${sv.withholdingPercent}%)`, value: sv.withholdingAmount, sign: sv.withholdingType === "TDS" ? "minus" : "plus" });
  }
  if (Math.abs(sv.adjustmentAmount) > 0.0005) totals.push({ label: sv.adjustmentLabel, value: sv.adjustmentAmount });

  const showGst = cfg.summary.showGstSplit !== false && mode !== "none";
  return {
    ...baseDoc(cfg, company),
    kind: "invoice",
    title: "TAX INVOICE",
    copyLabel: "Original for Recipient",
    number: inv.invoiceNumber,
    currency: inv.currency.toUpperCase(),
    party: cfg.party.show !== false ? docParty(cfg.party.label || "Bill To", cust) : null,
    detailsTitle: "Invoice Details",
    details,
    lines,
    columns: columnsOf(cfg, lines, { tax: true }),
    taxMode: mode,
    totals,
    total: cfg.summary.showTotal !== false ? { label: `Total (${inv.currency.toUpperCase()})`, value: sv.payableTotal } : null,
    headline: cfg.summary.showTotal !== false ? { label: "Amount payable", value: sv.payableTotal } : null,
    amountInWords: amountInWords(sv.payableTotal, inv.currency),
    gstSummary: showGst ? gstSummaryOf(lines) : null,
    gstSummaryNote: showGst && sv.discountAmount > 0 ? "Line values before the invoice-level discount." : null,
    // Notes/terms come from an explicitly chosen template only (unchanged behaviour).
    notes: footerNotes(template),
    bank: docBank(company),
    signature: signatureOf(template, docCompany(company).name),
    footerNote: "This is a computer-generated invoice.",
    watermark: inv.status === "DRAFT" ? "DRAFT" : inv.status === "VOID" ? "VOID" : null,
  };
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export type QuoteForDoc = Quote & {
  lines: (QuoteLine & { item?: { hsnCode: string | null; unit: string } | null })[];
  customer: Customer;
};

export function quoteToDocument(q: QuoteForDoc, company: CompanyForDocs | null, template: DocumentTemplateConfig | null): BusinessDocument {
  const cfg = template ?? DEFAULT_DOCUMENT_TEMPLATE_CONFIG;
  const lines: DocLine[] = q.lines.map((l) => ({
    description: l.description,
    hsn: l.item?.hsnCode?.trim() || null,
    qty: num(l.quantity),
    unit: l.item?.unit && l.item.unit !== "unit" ? l.item.unit : null,
    rate: num(l.rate),
    taxable: num(l.amount),
    taxPercent: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    tax: 0,
    amount: num(l.amount),
  }));
  const details: [string, string][] = [
    ["Quote No.", q.quoteNumber],
    ["Quote Date", fmtDocDate(q.quoteDate)],
  ];
  if (q.expiryDate) details.push(["Valid Until", fmtDocDate(q.expiryDate)]);
  if (q.reference?.trim()) details.push(["Reference", q.reference.trim()]);
  if (q.salesperson?.trim()) details.push(["Salesperson", q.salesperson.trim()]);
  if (q.projectName?.trim()) details.push(["Project", q.projectName.trim()]);
  const pos = stateWithCode(q.customer.billingState, q.customer.gstin);
  if (pos) details.push(["Place of Supply", pos]);

  const totals: DocTotalRow[] = [{ label: "Sub total", value: num(q.subTotal) }];
  const disc = num(q.discountAmount);
  if (disc > 0) totals.push({ label: q.discountMode === "PERCENT" ? `Discount (${num(q.discountInput)}%)` : "Discount", value: disc, sign: "minus" });
  const wh = num(q.taxAmount);
  if (wh > 0 && (q.withholdingType === "TDS" || q.withholdingType === "TCS")) {
    totals.push({ label: q.taxSelectLabel?.trim() || q.withholdingType, value: wh, sign: q.withholdingType === "TDS" ? "minus" : "plus" });
  }
  const adj = num(q.adjustmentAmount);
  if (Math.abs(adj) > 0.0005) totals.push({ label: q.adjustmentLabel || "Adjustment", value: adj });
  const total = num(q.total);

  const notes = footerNotes(template, [
    { title: "Subject", body: q.subject },
    { title: "Notes", body: q.customerNotes },
    { title: "Terms & Conditions", body: q.termsAndConditions },
  ]);
  return {
    ...baseDoc(cfg, company),
    kind: "quote",
    title: "QUOTATION",
    copyLabel: null,
    number: q.quoteNumber,
    currency: "INR",
    party: docParty("Quote For", q.customer),
    detailsTitle: "Quote Details",
    details,
    lines,
    columns: { ...columnsOf(cfg, lines, { tax: false }) },
    taxMode: "none",
    totals,
    total: { label: "Total (INR)", value: total },
    headline: { label: "Quoted amount", value: total },
    amountInWords: amountInWords(total),
    gstSummary: null,
    gstSummaryNote: null,
    notes,
    bank: docBank(company),
    signature: signatureOf(template, docCompany(company).name),
    footerNote: "This is a computer-generated quotation.",
    watermark: q.status === "DRAFT" ? "DRAFT" : null,
  };
}

// ── Credit note ───────────────────────────────────────────────────────────────

export type CreditNoteForDoc = CreditNote & {
  lines: (CreditNoteLine & { item?: { hsnCode: string | null; unit: string } | null })[];
  customer: Customer;
  invoice?: { invoiceNumber: string; issueDate: Date } | null;
};

export function creditNoteToDocument(cn: CreditNoteForDoc, company: CompanyForDocs | null, template: DocumentTemplateConfig | null): BusinessDocument {
  const cfg = template ?? DEFAULT_DOCUMENT_TEMPLATE_CONFIG;
  const lines = cn.lines.map(gstLine);
  const mode = taxModeOf(lines);
  const details: [string, string][] = [
    ["Credit Note No.", cn.creditNumber],
    ["Date", fmtDocDate(cn.issueDate)],
  ];
  if (cn.invoice) details.push(["Against Invoice", `${cn.invoice.invoiceNumber} (${fmtDocDate(cn.invoice.issueDate)})`]);
  const pos = stateWithCode(cn.customer.billingState, cn.customer.gstin);
  if (pos) details.push(["Place of Supply", pos]);

  const taxTotal = num(cn.taxTotal);
  const total = num(cn.total);
  const applied = num(cn.amountApplied);
  const totals: DocTotalRow[] = [{ label: "Taxable value", value: num(cn.subTotal) }, ...gstTotalRows(lines, mode, 1, taxTotal)];
  const showGst = mode !== "none";
  return {
    ...baseDoc(cfg, company),
    kind: "credit-note",
    title: "CREDIT NOTE",
    copyLabel: "Original for Recipient",
    number: cn.creditNumber,
    currency: "INR",
    party: docParty("Credit To", cn.customer),
    detailsTitle: "Credit Note Details",
    details,
    lines,
    columns: columnsOf(cfg, lines, { tax: true }),
    taxMode: mode,
    totals,
    total: { label: "Credit (INR)", value: total },
    headline: applied > 0 ? { label: "Credit remaining", value: round2(total - applied) } : { label: "Credit amount", value: total },
    amountInWords: amountInWords(total),
    gstSummary: showGst ? gstSummaryOf(lines) : null,
    gstSummaryNote: null,
    notes: footerNotes(template, [
      { title: "Reason", body: cn.reason },
      ...(applied > 0 ? [{ title: "Applied", body: `₹ ${applied.toLocaleString("en-IN", { minimumFractionDigits: 2 })} of this credit has been applied to invoices.` }] : []),
    ]),
    bank: null,
    signature: signatureOf(template, docCompany(company).name),
    footerNote: "This is a computer-generated credit note.",
    watermark: cn.status === "DRAFT" ? "DRAFT" : null,
  };
}

// ── Vendor bill (purchase invoice) ────────────────────────────────────────────

export type BillForDoc = VendorBill & {
  lines: (VendorBillLine & { item?: { hsnCode: string | null; unit: string } | null })[];
  vendor: Vendor;
};

export function billToDocument(b: BillForDoc, company: CompanyForDocs | null, template: DocumentTemplateConfig | null): BusinessDocument {
  const cfg = template ?? DEFAULT_DOCUMENT_TEMPLATE_CONFIG;
  const lines = b.lines.map(gstLine);
  const mode = taxModeOf(lines);
  const details: [string, string][] = [
    ["Bill No.", b.billNumber],
    ["Bill Date", fmtDocDate(b.billDate)],
  ];
  if (b.dueDate) details.push(["Due Date", fmtDocDate(b.dueDate)]);
  if (PAYMENT_TERMS[b.paymentTerms]) details.push(["Payment Terms", PAYMENT_TERMS[b.paymentTerms]!]);
  if (b.orderNumber?.trim()) details.push(["Order No.", b.orderNumber.trim()]);
  if (b.reference?.trim()) details.push(["Reference", b.reference.trim()]);
  const pos = stateWithCode(b.vendor.billingState, b.vendor.gstin);
  if (pos) details.push(["Supplier State", pos]);
  if (b.currency.toUpperCase() !== "INR") details.push(["Currency", b.currency.toUpperCase()]);

  const taxTotal = num(b.taxTotal);
  const totals: DocTotalRow[] = [{ label: "Taxable value", value: num(b.subTotal) }, ...gstTotalRows(lines, mode, 1, taxTotal)];
  const wh = num(b.withholdingAmount);
  if (wh > 0 && (b.withholdingType === "TDS" || b.withholdingType === "TCS")) {
    totals.push({ label: b.withholdingType, value: wh, sign: b.withholdingType === "TDS" ? "minus" : "plus" });
  }
  const adj = num(b.adjustmentAmount);
  if (Math.abs(adj) > 0.0005) totals.push({ label: "Adjustment", value: adj });
  const total = num(b.total);
  return {
    ...baseDoc(cfg, company),
    kind: "bill",
    title: "PURCHASE BILL",
    copyLabel: "Internal record",
    number: b.billNumber,
    currency: b.currency.toUpperCase(),
    party: docParty("Supplier", { ...b.vendor, pan: b.vendor.pan }),
    detailsTitle: "Bill Details",
    details,
    lines,
    columns: columnsOf(cfg, lines, { tax: true }),
    taxMode: mode,
    totals,
    total: { label: `Total (${b.currency.toUpperCase()})`, value: total },
    headline: { label: "Bill amount", value: total },
    amountInWords: amountInWords(total, b.currency),
    gstSummary: mode !== "none" ? gstSummaryOf(lines) : null,
    gstSummaryNote: null,
    notes: footerNotes(null, [
      { title: "Subject", body: b.subject },
      { title: "Notes", body: b.notesInternal },
    ]),
    bank: null,
    signature: null,
    footerNote: "Purchase bill recorded in FASTPLUS.",
    watermark: b.status === "DRAFT" ? "DRAFT" : b.status === "VOID" ? "VOID" : null,
  };
}

// ── Expense voucher ───────────────────────────────────────────────────────────

export type ExpenseForDoc = {
  id: string;
  expenseDate: Date;
  invoiceNumber: string | null;
  amount: { toString(): string };
  taxAmount: { toString(): string };
  notes: string | null;
  journalEntryId: string | null;
  expenseAccount: { code: string; name: string };
  bankAccount: { code: string; name: string };
  vendor: Vendor | null;
};

export function expenseToDocument(e: ExpenseForDoc, company: CompanyForDocs | null): BusinessDocument {
  const cfg = DEFAULT_DOCUMENT_TEMPLATE_CONFIG;
  const amount = num(e.amount);
  const tax = num(e.taxAmount);
  const total = round2(amount + tax);
  const voucherNo = `EXP-${e.expenseDate.toISOString().slice(0, 10).replace(/-/g, "")}-${e.id.slice(-6).toUpperCase()}`;
  const details: [string, string][] = [
    ["Voucher No.", voucherNo],
    ["Expense Date", fmtDocDate(e.expenseDate)],
    ["Paid From", `${e.bankAccount.code} — ${e.bankAccount.name}`],
    ["Status", e.journalEntryId ? "Posted to ledger" : "Not posted"],
  ];
  if (e.invoiceNumber?.trim()) details.splice(2, 0, ["Supplier Invoice", e.invoiceNumber.trim()]);
  const lines: DocLine[] = [
    {
      description: `${e.expenseAccount.name} (${e.expenseAccount.code})`,
      hsn: null,
      qty: null,
      unit: null,
      rate: null,
      taxable: amount,
      // Expenses store only a tax amount, not a GST rate.
      taxPercent: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      tax,
      amount: total,
    },
  ];
  return {
    ...baseDoc(cfg, company),
    kind: "expense",
    title: "EXPENSE VOUCHER",
    copyLabel: "Internal record",
    number: voucherNo,
    currency: "INR",
    party: e.vendor ? docParty("Paid To", e.vendor) : null,
    detailsTitle: "Voucher Details",
    details,
    lines,
    columns: { hsn: false, qty: false, rate: false, taxable: true, tax: tax !== 0, amount: true },
    taxMode: tax !== 0 ? "mixed" : "none",
    totals: [
      { label: "Amount", value: amount },
      ...(tax ? [{ label: "Tax", value: tax }] : []),
    ],
    total: { label: "Total (INR)", value: total },
    headline: { label: "Amount paid", value: total },
    amountInWords: amountInWords(total),
    gstSummary: null,
    gstSummaryNote: null,
    notes: e.notes?.trim() ? [{ title: "Notes", body: e.notes.trim() }] : [],
    bank: null,
    signature: { forLabel: `For ${docCompany(company).name}`, label: "Approved by" },
    footerNote: "Expense voucher generated by FASTPLUS.",
    watermark: null,
  };
}
