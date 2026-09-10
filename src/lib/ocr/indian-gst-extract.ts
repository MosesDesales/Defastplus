/**
 * Indian GST invoice field extraction using semantic label matching.
 * Works on noisy OCR text — no fixed coordinates required.
 */
import { isInterState } from "@/lib/gst/split";
import { normalizeGstin } from "@/lib/gstin";
import { extractAllPartyTaxIds, isIndianGstin15 } from "@/lib/ocr/gstin-detect";
import {
  AMOUNT_PAID_LABELS,
  BALANCE_LABELS,
  BUYER_LABELS,
  CGST_LABELS,
  CESS_LABELS,
  DISCOUNT_LABELS,
  DUE_DATE_LABELS,
  EMAIL_LABELS,
  EWAY_LABELS,
  GRAND_TOTAL_LABELS,
  GSTIN_LABELS,
  IGST_LABELS,
  INDIAN_STATE_CODES,
  INVOICE_DATE_LABELS,
  INVOICE_NO_LABELS,
  PAN_LABELS,
  PHONE_LABELS,
  PLACE_OF_SUPPLY_LABELS,
  PO_LABELS,
  ROUND_OFF_LABELS,
  SGST_LABELS,
  SUBTOTAL_LABELS,
  SUPPLIER_LABELS,
  TAXABLE_VALUE_LABELS,
  TCS_LABELS,
  TDS_LABELS,
} from "@/lib/ocr/label-synonyms";
import { extractStrictCurrencyAmounts, pickBestDocumentTotal } from "@/lib/ocr/normalize-money";
import type { OcrDocumentType, OcrExtractedDocument, OcrExtractedLineItem } from "@/lib/ocr/types";
import { parseReceiptText } from "@/lib/receipt-ocr";

function linesOf(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function parseMoneyFromLine(line: string, labelRe: RegExp): number | undefined {
  const stripped = line.replace(labelRe, "").trim();
  const amounts = extractStrictCurrencyAmounts(stripped || line);
  if (amounts.length) return amounts[amounts.length - 1];
  const n = Number.parseFloat(stripped.replace(/[₹,]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function parseTextAfterLabel(lines: string[], labelRe: RegExp, maxJoin = 2): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!labelRe.test(line)) continue;
    const inline = line.replace(labelRe, "").trim();
    if (inline.length >= 2 && !/^(?:₹|INR|\$)/i.test(inline)) return inline.slice(0, 240);
    for (let j = 1; j <= maxJoin && i + j < lines.length; j++) {
      const next = lines[i + j]!.trim();
      if (next.length >= 2 && !/^(?:total|gst|cgst|amount)/i.test(next)) return next.slice(0, 240);
    }
  }
  return undefined;
}

function parseDateAfterLabel(lines: string[], labelRe: RegExp): string | undefined {
  for (const line of lines) {
    if (!labelRe.test(line)) continue;
    const receipt = parseReceiptText(line);
    if (receipt.dateYmd) return receipt.dateYmd;
    const tail = line.replace(labelRe, "");
    const r2 = parseReceiptText(tail);
    if (r2.dateYmd) return r2.dateYmd;
  }
  return undefined;
}

function extractPan(text: string, gstin?: string): string | undefined {
  for (const line of linesOf(text)) {
    if (!PAN_LABELS.test(line)) continue;
    const m = line.match(/\b([A-Z]{5}\d{4}[A-Z])\b/i);
    if (m) return m[1]!.toUpperCase();
  }
  if (gstin && isIndianGstin15(gstin)) return gstin.slice(2, 12);
  return undefined;
}

function extractContact(text: string): { phone?: string; email?: string } {
  let phone: string | undefined;
  let email: string | undefined;
  for (const line of linesOf(text)) {
    if (!phone && PHONE_LABELS.test(line)) {
      const m = line.match(/(?:\+91[\s-]?)?[6-9]\d{9}|\d{10,12}/);
      if (m) phone = m[0]!.replace(/\s/g, "");
    }
    if (!email && EMAIL_LABELS.test(line)) {
      const m = line.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      if (m) email = m[0]!.toLowerCase();
    }
  }
  return { phone, email };
}

function pickPartyGstin(taxIds: string[], documentType: OcrDocumentType, companyGstin: string | null): string | undefined {
  const c = companyGstin?.trim().toUpperCase();
  if (taxIds.length === 0) return undefined;
  if (documentType === "INVOICE") {
    if (c) {
      const notSelf = taxIds.find((g) => g !== c);
      if (notSelf) return notSelf;
    }
    return taxIds.length >= 2 ? taxIds[1] : taxIds[0];
  }
  if (documentType === "BILL" || documentType === "EXPENSE") {
    if (c) {
      const notSelf = taxIds.find((g) => g !== c);
      if (notSelf) return notSelf;
    }
    return taxIds[0];
  }
  return taxIds[0];
}

/** Indian GST table row: description HSN qty rate taxable cgst sgst amount */
function extractIndianLineItems(text: string): OcrExtractedLineItem[] {
  const items: OcrExtractedLineItem[] = [];
  const rowRes = [
    /^(.{2,100}?)\s+(\d{4,8})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/i,
    /^(\d+)\s+(.{2,100}?)\s+(\d{4,8})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i,
    /^(.{2,80}?)\s+(\d{4,8})\s+(\d+(?:\.\d+)?)\s+(?:nos|pcs|kg|ltr|units?)?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i,
  ];

  for (const line of linesOf(text)) {
    if (/^(?:sr|s\.?\s*no|description|hsn|qty|rate|amount|total|tax|cgst|sgst|igst)/i.test(line)) continue;
    if (/^[\d\s₹,.-]+$/.test(line)) continue;

    for (const re of rowRes) {
      const m = line.match(re);
      if (!m) continue;
      let name: string;
      let hsn: string;
      let qty: number;
      let rate: number;
      let amount: number;

      if (m.length >= 7 && /^\d+$/.test(m[1]!)) {
        name = m[2]!.trim();
        hsn = m[3]!;
        qty = Number.parseFloat(m[4]!);
        rate = Number.parseFloat(m[5]!);
        amount = Number.parseFloat(m[6]!);
      } else if (m.length >= 6) {
        name = m[1]!.trim();
        hsn = m[2]!;
        qty = Number.parseFloat(m[3]!);
        rate = Number.parseFloat(m[4]!);
        amount = Number.parseFloat(m[5]!);
      } else continue;

      if (!Number.isFinite(qty) || !Number.isFinite(rate) || name.length < 2) continue;
      items.push({
        name: name.slice(0, 500),
        hsnSac: hsn,
        qty: qty > 0 ? qty : 1,
        rate,
        amount: Number.isFinite(amount) ? amount : undefined,
        confidence: 0.72,
      });
      break;
    }
    if (items.length >= 50) break;
  }
  return items;
}

function extractFooterAmounts(text: string, lines: string[]): Partial<OcrExtractedDocument> {
  const pick = (labelRe: RegExp) => {
    for (const line of lines) {
      if (!labelRe.test(line)) continue;
      const v = parseMoneyFromLine(line, labelRe);
      if (v != null) return v;
    }
    return undefined;
  };

  const cgst = pick(CGST_LABELS);
  const sgst = pick(SGST_LABELS);
  const igst = pick(IGST_LABELS);
  const cess = pick(CESS_LABELS);
  const tcs = pick(TCS_LABELS);
  const tds = pick(TDS_LABELS);
  const totalTax =
    cgst != null || sgst != null || igst != null
      ? Math.round(((cgst ?? 0) + (sgst ?? 0) + (igst ?? 0) + (cess ?? 0)) * 100) / 100
      : undefined;

  return {
    taxableValue: pick(TAXABLE_VALUE_LABELS),
    subtotal: pick(SUBTOTAL_LABELS),
    discount: pick(DISCOUNT_LABELS),
    roundOff: pick(ROUND_OFF_LABELS),
    cgst,
    sgst,
    igst,
    cess,
    tcs,
    tds,
    totalTax,
    total: pick(GRAND_TOTAL_LABELS) ?? pickBestDocumentTotal(text),
    amountPaid: pick(AMOUNT_PAID_LABELS),
    balanceDue: pick(BALANCE_LABELS),
  };
}

export function extractIndianGstDocument(
  text: string,
  documentType: OcrDocumentType,
  companyGstin: string | null,
): OcrExtractedDocument {
  const block = text.replace(/\r/g, "");
  const lines = linesOf(block);
  const receipt = parseReceiptText(block);
  const taxIds = extractAllPartyTaxIds(block);
  const partyGstin = pickPartyGstin(taxIds, documentType, companyGstin);

  const supplierName = parseTextAfterLabel(lines, SUPPLIER_LABELS);
  const buyerName = parseTextAfterLabel(lines, BUYER_LABELS);
  const partyName =
    documentType === "BILL" || documentType === "EXPENSE"
      ? supplierName ?? receipt.merchantHint
      : buyerName ?? receipt.merchantHint;

  const gstinFromLabel = parseTextAfterLabel(lines, GSTIN_LABELS);
  const resolvedGstin = gstinFromLabel ? normalizeGstin(gstinFromLabel) : partyGstin;

  const placeOfSupply = parseTextAfterLabel(lines, PLACE_OF_SUPPLY_LABELS);
  const stateCode = resolvedGstin && isIndianGstin15(resolvedGstin) ? resolvedGstin.slice(0, 2) : undefined;

  const footer = extractFooterAmounts(block, lines);
  let items = extractIndianLineItems(block);
  if (items.length === 0 && footer.total != null) {
    items = [{ name: "Line 1", qty: 1, rate: footer.subtotal ?? footer.total, amount: footer.total, confidence: 0.45 }];
  }

  const contact = extractContact(block);
  const supplyIsInterState =
    resolvedGstin && companyGstin?.trim() && isIndianGstin15(resolvedGstin)
      ? isInterState(companyGstin.trim(), resolvedGstin)
      : undefined;

  return {
    partyName: partyName?.slice(0, 200),
    partyAddress: parseTextAfterLabel(lines, SUPPLIER_LABELS, 3),
    partyGstin: resolvedGstin,
    partyPan: extractPan(block, resolvedGstin),
    partyStateCode: stateCode,
    partyPhone: contact.phone,
    partyEmail: contact.email,
    invoiceNo: parseTextAfterLabel(lines, INVOICE_NO_LABELS) ?? receipt.invoiceNumber,
    invoiceDate: parseDateAfterLabel(lines, INVOICE_DATE_LABELS) ?? receipt.dateYmd,
    dueDate: parseDateAfterLabel(lines, DUE_DATE_LABELS) ?? receipt.dueDateYmd,
    purchaseOrderNo: parseTextAfterLabel(lines, PO_LABELS),
    ewayBillNo: parseTextAfterLabel(lines, EWAY_LABELS),
    placeOfSupply: placeOfSupply ?? (stateCode ? INDIAN_STATE_CODES[stateCode] : undefined),
    items,
    ...footer,
    supplyIsInterState,
    warnings: [],
    meta: { parseMode: "indian_gst" },
  };
}
