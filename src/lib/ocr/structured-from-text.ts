import { z } from "zod";
import { isInterState } from "@/lib/gst/split";
import { extractAllPartyTaxIds, isIndianGstin15 } from "@/lib/ocr/gstin-detect";
import {
  extractStrictCurrencyAmounts,
  parseNumericTokens,
  pickBestDocumentTotal,
} from "@/lib/ocr/normalize-money";
import type { OcrDocumentType, OcrExtractedDocument, OcrExtractedLineItem } from "@/lib/ocr/types";
import { parseReceiptText } from "@/lib/receipt-ocr";
import { validateAndReconcileExtraction } from "@/lib/ocr/validate-extraction";
import { extractIndianGstDocument } from "@/lib/ocr/indian-gst-extract";

const aiItemSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  qty: z.union([z.number(), z.string()]).optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  rate: z.union([z.number(), z.string()]).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  tax: z.union([z.number(), z.string()]).optional(),
  tax_percent: z.union([z.number(), z.string()]).optional(),
  taxPercent: z.union([z.number(), z.string()]).optional(),
});

const aiDocSchema = z.object({
  vendor: z.string().optional().nullable(),
  customer: z.string().optional().nullable(),
  party_name: z.string().optional().nullable(),
  invoice_no: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  invoice_date: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  items: z.array(aiItemSchema).optional().nullable(),
  total: z.union([z.number(), z.string()]).optional().nullable(),
  subtotal: z.union([z.number(), z.string()]).optional().nullable(),
  cgst: z.union([z.number(), z.string()]).optional().nullable(),
  sgst: z.union([z.number(), z.string()]).optional().nullable(),
  igst: z.union([z.number(), z.string()]).optional().nullable(),
});

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeYmd(s?: string | null): string | undefined {
  if (!s?.trim()) return undefined;
  const t = s.trim();
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return undefined;
}

function normalizeItem(row: z.infer<typeof aiItemSchema>): OcrExtractedLineItem | null {
  const name = row.name?.trim();
  if (!name) return null;
  const qty = num(row.qty ?? row.quantity) ?? 1;
  const rate = num(row.rate) ?? 0;
  const amount = num(row.amount);
  const taxPercent = num(row.tax_percent ?? row.taxPercent ?? row.tax);
  return {
    name: name.slice(0, 500),
    description: row.description?.trim() || undefined,
    qty: qty > 0 ? qty : 1,
    rate: rate >= 0 ? rate : 0,
    amount,
    taxPercent: taxPercent !== undefined ? Math.min(100, Math.max(0, taxPercent)) : undefined,
  };
}

function lineLooksLikeInvoiceNumber(line: string): boolean {
  const t = line.trim();
  return (
    /^INV[-\s./]?[A-Z0-9]{3,}$/i.test(t) ||
    /^BILL[-\s./]?[A-Z0-9]{3,}$/i.test(t) ||
    /^[A-Z]{2,}\d+[A-Z0-9\-./]*$/i.test(t)
  );
}

function lineLooksLikeTaxId(line: string): boolean {
  return extractAllPartyTaxIds(line).length > 0;
}

function sanitizeLineItems(items: OcrExtractedLineItem[]): OcrExtractedLineItem[] {
  return items.filter((it) => {
    const name = it.name.trim();
    if (name.length < 2) return false;
    if (lineLooksLikeSummaryRow(name)) return false;
    if (/^gst\b|^igst\b|^cgst\b|^sgst\b|^tax\b|^sub\s*-?\s*total|^total\b|^amount\s*due/i.test(name.toLowerCase())) {
      return false;
    }
    if (it.rate <= 0 && (it.amount ?? 0) <= 0) return false;
    if ((it.amount ?? it.rate * it.qty) > 5_000_000) return false;
    return true;
  });
}

function lineLooksLikeSummaryRow(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /page\s+\d+\s+of\s+\d+/i.test(line) ||
    /^\s*(?:sub\s*-?\s*total|grand\s*total|total|amount\s*due|balance\s*due|invoice\s*total)\b/i.test(lower) ||
    /^gst\b|^igst\b|^cgst\b|^sgst\b|^tax\s*@|^vat\b/i.test(lower) ||
    /tax\s*%|total\s*excl/i.test(lower)
  );
}

function lineLooksLikeProductRow(line: string): boolean {
  if (lineLooksLikeSummaryRow(line)) return false;
  if (lineLooksLikeTaxId(line)) return false;
  if (lineLooksLikeInvoiceNumber(line)) return false;
  if (/^(?:date|issue|due)\b/i.test(line)) return false;
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(line)) return false;
  if (/^(qty|rate|amount|description|item|hsn|sac|total|tax|cgst|sgst|igst|sl\s*no|unit\s*price)/i.test(line)) return false;
  return /[A-Za-z]{2,}/.test(line);
}

function heuristicItemsFromTable(text: string): OcrExtractedLineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: OcrExtractedLineItem[] = [];
  const rowRe =
    /^(.{2,120}?)[\t|\s]{2,}(\d+(?:,\d{3})*(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$/;
  for (const line of lines) {
    const m = line.match(rowRe);
    if (!m) continue;
    const name = m[1]!.trim();
    if (/^(qty|rate|amount|description|item|hsn|sac|total|tax)/i.test(name)) continue;
    const qty = Number.parseFloat(m[2]!.replace(/,/g, ""));
    const rate = Number.parseFloat(m[3]!.replace(/,/g, ""));
    const amount = Number.parseFloat(m[4]!.replace(/,/g, ""));
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) continue;
    items.push({
      name,
      qty,
      rate,
      amount: Number.isFinite(amount) ? amount : undefined,
    });
    if (items.length >= 40) break;
  }
  return items;
}

function heuristicItemsFromWhitespaceNumbers(text: string): OcrExtractedLineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: OcrExtractedLineItem[] = [];

  for (const line of lines) {
    if (!lineLooksLikeProductRow(line)) continue;

    const tokens = line.split(/\s+/).filter(Boolean);
    let firstNum = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (/^[$₹]?[\d,.]+%?$/.test(tokens[i]!)) {
        firstNum = i;
        break;
      }
    }
    if (firstNum <= 0) continue;

    const name = tokens.slice(0, firstNum).join(" ").trim();
    if (name.length < 2 || name.length > 200) continue;

    const nums = parseNumericTokens(tokens.slice(firstNum));
    if (nums.length < 2) continue;

    let qty = 1;
    let rate = nums[0]!;
    let taxPercent: number | undefined;
    let amount: number | undefined;

    if (
      nums.length >= 4 &&
      nums[0]! > 0 &&
      nums[0]! < 500_000 &&
      nums[0]! === Math.floor(nums[0]!) &&
      nums[1]! > nums[0]! &&
      nums[2]! <= 45
    ) {
      qty = nums[0]!;
      rate = nums[1]!;
      taxPercent = nums[2]!;
      amount = nums[nums.length - 1];
    } else if (nums.length >= 3 && nums[0]! > 0 && nums[0]! < 500_000 && nums[0]! === Math.floor(nums[0]!) && nums[1]! > nums[0]!) {
      qty = nums[0]!;
      rate = nums[1]!;
      amount = nums[nums.length - 1];
    } else if (nums.length === 2) {
      qty = 1;
      rate = nums[0]!;
      amount = nums[1]!;
    } else {
      rate = nums[0]!;
      amount = nums[nums.length - 1];
    }

    if (!Number.isFinite(rate) || rate <= 0) continue;
    if (amount !== undefined && amount > 0 && amount < rate * qty * 0.5) continue;

    items.push({
      name: name.slice(0, 500),
      qty,
      rate,
      amount,
      taxPercent,
    });
    if (items.length >= 40) break;
  }

  return items;
}

/**
 * Rows with multiple ₹ / INR amounts (common in SaaS / foreign PDF text).
 * Example: `KVM 4 (billed monthly) ₹2,599.00 ₹467.82 ₹3,066.82`
 */
function heuristicItemsFromCurrencyLines(text: string): OcrExtractedLineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: OcrExtractedLineItem[] = [];

  for (const line of lines) {
    if (!/(₹|INR|\$|USD)/i.test(line)) continue;
    if (lineLooksLikeSummaryRow(line)) continue;
    const amounts = extractStrictCurrencyAmounts(line);
    if (amounts.length < 1) continue;
    if (/order\s*(?:nr|no|#)|\bhb_\d+/i.test(line)) continue;

    const cut = line.split(/₹|INR/i);
    let desc = (cut[0] ?? "").trim();
    desc = desc.replace(/^[\d\-–—.\s]+/, "").trim();
    if (desc.length < 2 || desc.length > 280) continue;
    if (/^(qty|description|item|sl\.?\s*no|amount|rate)/i.test(desc)) continue;

    const n = amounts.length;
    const last = amounts[n - 1]!;
    const first = amounts[0]!;
    let qty = 1;
    let rate = first;
    let amount = last;
    let taxPercent: number | undefined;

    if (n >= 3) {
      rate = first;
      const mid = amounts[n - 2]!;
      if (mid > 0 && mid < last && rate > 0) {
        const implied = Math.round((mid / rate) * 10_000) / 100;
        if (implied > 0.5 && implied <= 45) taxPercent = implied;
      }
    } else if (n === 1) {
      rate = last;
      amount = last;
    }

    if (last < first * 0.5 && n >= 2) continue;

    items.push({
      name: desc.slice(0, 500),
      qty,
      rate,
      amount,
      taxPercent,
    });
    if (items.length >= 40) break;
  }

  return items;
}

function heuristicSubtotalFromText(text: string): number | undefined {
  const block = text.replace(/\r/g, "");
  const m =
    block.match(/total\s*excl\.?(?:\s*\(?\s*IGST|\s*GST|\s*tax\)?)?\s*[.:]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ??
    block.match(/\bsub[-\s]?total\s*[.:]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i);
  if (!m?.[1]) return undefined;
  const n = Number.parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function heuristicTaxAmountFromText(text: string): number | undefined {
  const block = text.replace(/\r/g, "");
  const m =
    block.match(/(?:IGST|GST|CGST|SGST|VAT)\s*(?:-\s*[\w\s]+)?\(\s*\d+\s*%\s*\)\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ??
    block.match(/(?:IGST|GST)\s*(?:@\s*[\d.]+\s*%?)?\s*[.:]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i);
  if (!m?.[1]) return undefined;
  const n = Number.parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function heuristicGstTotals(text: string): Pick<OcrExtractedDocument, "cgst" | "sgst" | "igst"> {
  const block = text.replace(/\r/g, "");
  const pick = (label: RegExp) => {
    const m = block.match(label);
    return m?.[1] ? Number.parseFloat(m[1].replace(/,/g, "")) : undefined;
  };
  const igst =
    pick(/IGST\s*(?:@\s*[\d.]+\s*%?)?\s*[.:]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ??
    pick(/IGST\s*[:.]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ??
    pick(/GST\s*(?:-\s*[\w\s]+)?\(\s*\d+\s*%\s*\)\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ??
    heuristicTaxAmountFromText(block);
  return {
    cgst: pick(/CGST\s*[:.]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ?? pick(/CGST\s+(?:₹|INR|\$)?\s*([\d,.]+)/i),
    sgst: pick(/SGST\s*[:.]?\s*(?:₹|INR|\$)?\s*([\d,.]+)/i) ?? pick(/SGST\s+(?:₹|INR|\$)?\s*([\d,.]+)/i),
    igst,
  };
}

function pickPartyTaxId(taxIds: string[], documentType: OcrDocumentType, companyGstin: string | null): string | undefined {
  const c = companyGstin?.trim().toUpperCase();
  if (taxIds.length === 0) return undefined;
  if (documentType === "INVOICE") {
    if (c) {
      const notSelf = taxIds.find((g) => g !== c);
      if (notSelf) return notSelf;
    }
    return taxIds.length >= 2 ? taxIds[1] : taxIds[0];
  }
  if (documentType === "BILL") {
    if (c) {
      const notSelf = taxIds.find((g) => g !== c);
      if (notSelf) return notSelf;
    }
    return taxIds[0];
  }
  return taxIds[0];
}

function inferPartyName(
  block: string,
  documentType: OcrDocumentType,
  taxIds: string[],
  receiptMerchant?: string,
): string | undefined {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const skipLine = (line: string) => {
    if (line.length < 4) return true;
    if (!/[A-Za-z]{2,}/.test(line)) return true;
    if (lineLooksLikeInvoiceNumber(line)) return true;
    if (/^[A-Z0-9]{2,}[-/]?\d{2,}[A-Z0-9\-./]*$/i.test(line.trim()) && /\d/.test(line)) return true;
    if (lineLooksLikeTaxId(line)) return true;
    if (/^[\d\s₹,.-]+$/.test(line)) return true;
    if (/tax\s*invoice|credit\s*note|original|duplicate|e-?way/i.test(line)) return true;
    if (/^page\s+\d+\s+of\s+\d+$/i.test(line)) return true;
    if (/^(tax|tally|invoice|bill|date|amount|total|gst|qty|rate|hsn|sac|cgst|sgst|igst|thank)/i.test(line)) return true;
    return false;
  };

  const labeledVendor =
    block.match(/(?:supplier|vendor|from|seller|sold\s*by|merchant)\s*[:\n]\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const labeledCustomer =
    block.match(/(?:bill\s*to|ship\s*to|customer|buyer|consignee)\s*[:\n]\s*([^\n]+)/i)?.[1]?.trim() ?? "";

  if (documentType === "BILL" && labeledVendor.length > 2) return labeledVendor.slice(0, 200);
  if (documentType === "INVOICE" && labeledCustomer.length > 2) return labeledCustomer.slice(0, 200);

  const goodLines = lines.filter((l) => !skipLine(l));

  if (documentType === "BILL") {
    if (receiptMerchant && !skipLine(receiptMerchant)) return receiptMerchant.slice(0, 200);
    return goodLines[0]?.slice(0, 200);
  }

  if (labeledCustomer.length > 2) return labeledCustomer.slice(0, 200);
  if (goodLines.length >= 2) return goodLines[1]!.slice(0, 200);
  if (goodLines.length === 1) return goodLines[0]!.slice(0, 200);
  return receiptMerchant?.slice(0, 200);
}

function mergeTotalsPreferPlausible(
  heuristicTotal: number | undefined,
  aiTotal: number | undefined,
): number | undefined {
  if (heuristicTotal === undefined) return aiTotal;
  if (aiTotal === undefined) return heuristicTotal;
  if (!Number.isFinite(aiTotal) || aiTotal <= 0) return heuristicTotal;
  if (!Number.isFinite(heuristicTotal) || heuristicTotal <= 0) return aiTotal;
  const ratio = aiTotal / heuristicTotal;
  if (ratio > 3 || ratio < 0.33) return heuristicTotal;
  return aiTotal;
}

export function extractStructuredHeuristic(
  text: string,
  documentType: OcrDocumentType,
  companyGstin: string | null,
): OcrExtractedDocument {
  const warnings: string[] = [];
  const block = text.replace(/\r/g, "");
  const taxIds = extractAllPartyTaxIds(block);
  const partyGstin = pickPartyTaxId(taxIds, documentType, companyGstin);
  const supplyIsInterState =
    partyGstin && companyGstin?.trim() && isIndianGstin15(partyGstin)
      ? isInterState(companyGstin.trim(), partyGstin)
      : undefined;

  if (documentType === "EXPENSE") {
    const r = parseReceiptText(block);
    const items: OcrExtractedLineItem[] = [];
    if (r.amount !== undefined) {
      items.push({ name: "Receipt total", qty: 1, rate: r.amount, taxPercent: undefined });
    }
    return {
      partyName: r.merchantHint,
      invoiceNo: r.invoiceNumber,
      invoiceDate: r.dateYmd,
      dueDate: r.dueDateYmd,
      items,
      total: r.amount,
      partyGstin: partyGstin ?? undefined,
      supplyIsInterState,
      cgst: undefined,
      sgst: undefined,
      igst: undefined,
      warnings,
      meta: { parseMode: "heuristic" },
    };
  }

  const receiptLike = parseReceiptText(block);
  let items = heuristicItemsFromTable(block);
  if (items.length === 0) {
    items = heuristicItemsFromWhitespaceNumbers(block);
  }
  if (items.length === 0) {
    items = heuristicItemsFromCurrencyLines(block);
  }
  items = sanitizeLineItems(items);

  const taxBits = heuristicGstTotals(block);
  const subtotal = heuristicSubtotalFromText(block);
  const labeledTotal = pickBestDocumentTotal(block);
  const taxSum = (taxBits.cgst ?? 0) + (taxBits.sgst ?? 0) + (taxBits.igst ?? 0);
  const footerTotal =
    subtotal != null && taxSum > 0 ? Math.round((subtotal + taxSum) * 100) / 100 : undefined;
  const resolvedTotal = labeledTotal ?? footerTotal ?? receiptLike.amount;

  if (items.length === 0 && resolvedTotal !== undefined) {
    items.push({ name: "Line 1", qty: 1, rate: subtotal ?? resolvedTotal });
    warnings.push("Could not detect line-item table — created a single line from totals.");
  }

  const partyName = inferPartyName(block, documentType, taxIds, receiptLike.merchantHint);

  return {
    partyName,
    partyGstin: partyGstin ?? undefined,
    invoiceNo: receiptLike.invoiceNumber,
    invoiceDate: receiptLike.dateYmd,
    dueDate: receiptLike.dueDateYmd,
    items,
    total: resolvedTotal,
    subtotal,
    supplyIsInterState,
    ...taxBits,
    warnings,
    meta: { parseMode: "heuristic" },
  };
}

async function extractWithOpenAi(
  text: string,
  documentType: OcrDocumentType,
  companyGstin: string | null,
): Promise<OcrExtractedDocument | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const roleHint =
    documentType === "INVOICE"
      ? "This is a sales invoice received from a customer (you are the supplier on the paper — extract the CUSTOMER / buyer details as party_name)."
      : documentType === "BILL"
        ? "This is a purchase bill from a vendor (extract the VENDOR / supplier as party_name)."
        : "This is an expense receipt (merchant as party_name).";

  const prompt = [
    roleHint,
    "From the OCR text, return ONLY valid JSON with keys:",
    `party_name, party_gstin (GSTIN / UEN / foreign tax registration if shown), invoice_no, invoice_date (yyyy-mm-dd if possible), due_date,`,
    `items (array of {name, qty, rate, amount, tax_percent}), total, subtotal, cgst, sgst, igst.`,
    "Use numbers for numeric fields. Use null when unknown.",
    "Documents may be Indian (CGST/SGST or IGST) or international. Extract IGST when only IGST appears; otherwise CGST/SGST when present.",
    "Never use order numbers, reference IDs, or concatenated digits (e.g. hb_49050517) as total — total must match the invoice Total / Grand Total line with proper decimals.",
    "If line items show per-line tax and totals, item.amount should be the line total including tax when that is how the table reads.",
    "",
    "OCR TEXT:",
    text.slice(0, 14_000),
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You convert noisy OCR from business invoices (India and international) into strict JSON only. Never invent totals.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) {
    console.warn("OpenAI OCR parse failed:", raw.error?.message);
    return null;
  }
  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const zr = aiDocSchema.safeParse(parsed);
  if (!zr.success) return null;
  const o = zr.data;
  const items = (o.items ?? [])
    .map((row) => normalizeItem(row))
    .filter((x): x is OcrExtractedLineItem => Boolean(x));

  const partyGstin = o.gstin?.trim() || undefined;
  const supplyIsInterState =
    partyGstin && companyGstin?.trim() && isIndianGstin15(partyGstin)
      ? isInterState(companyGstin.trim(), partyGstin)
      : undefined;

  return {
    partyName: (o.party_name ?? o.vendor ?? o.customer ?? "").trim() || undefined,
    partyGstin,
    invoiceNo: (o.invoice_no ?? o.invoice_number ?? "").trim() || undefined,
    invoiceDate: normalizeYmd(o.invoice_date ?? o.date ?? undefined),
    dueDate: normalizeYmd(o.due_date ?? undefined),
    items,
    total: num(o.total),
    subtotal: num(o.subtotal),
    cgst: num(o.cgst),
    sgst: num(o.sgst),
    igst: num(o.igst),
    supplyIsInterState,
    warnings: [],
    meta: { parseMode: "openai" },
  };
}

function mergeGstDocuments(base: OcrExtractedDocument, indian: OcrExtractedDocument): OcrExtractedDocument {
  const pickItems =
    indian.items.length > 0 && indian.items.some((i) => i.hsnSac)
      ? indian.items
      : base.items.length >= indian.items.length
        ? base.items
        : indian.items;

  return {
    ...base,
    ...indian,
    partyName: indian.partyName ?? base.partyName,
    partyAddress: indian.partyAddress ?? base.partyAddress,
    partyGstin: indian.partyGstin ?? base.partyGstin,
    partyPan: indian.partyPan ?? base.partyPan,
    partyStateCode: indian.partyStateCode ?? base.partyStateCode,
    partyPhone: indian.partyPhone ?? base.partyPhone,
    partyEmail: indian.partyEmail ?? base.partyEmail,
    invoiceNo: indian.invoiceNo ?? base.invoiceNo,
    invoiceDate: indian.invoiceDate ?? base.invoiceDate,
    dueDate: indian.dueDate ?? base.dueDate,
    purchaseOrderNo: indian.purchaseOrderNo ?? base.purchaseOrderNo,
    ewayBillNo: indian.ewayBillNo ?? base.ewayBillNo,
    placeOfSupply: indian.placeOfSupply ?? base.placeOfSupply,
    taxableValue: indian.taxableValue ?? base.taxableValue,
    subtotal: indian.subtotal ?? base.subtotal,
    discount: indian.discount ?? base.discount,
    roundOff: indian.roundOff ?? base.roundOff,
    cgst: indian.cgst ?? base.cgst,
    sgst: indian.sgst ?? base.sgst,
    igst: indian.igst ?? base.igst,
    cess: indian.cess ?? base.cess,
    tcs: indian.tcs ?? base.tcs,
    tds: indian.tds ?? base.tds,
    totalTax: indian.totalTax ?? base.totalTax,
    total: mergeTotalsPreferPlausible(base.total, indian.total) ?? indian.total ?? base.total,
    amountPaid: indian.amountPaid ?? base.amountPaid,
    balanceDue: indian.balanceDue ?? base.balanceDue,
    items: pickItems,
    supplyIsInterState: indian.supplyIsInterState ?? base.supplyIsInterState,
    warnings: [...new Set([...(base.warnings ?? []), ...(indian.warnings ?? [])])],
    meta: { ...base.meta, parseMode: "indian_gst" },
  };
}

export async function buildStructuredExtraction(
  rawText: string,
  documentType: OcrDocumentType,
  companyGstin: string | null,
  ocrConfidence: number,
  textEngine: string,
): Promise<OcrExtractedDocument> {
  const heuristic = extractStructuredHeuristic(rawText, documentType, companyGstin);
  const indian =
    documentType === "EXPENSE"
      ? heuristic
      : mergeGstDocuments(heuristic, extractIndianGstDocument(rawText, documentType, companyGstin));

  let merged: OcrExtractedDocument = {
    ...indian,
    meta: { ...indian.meta, ocrEngine: textEngine, parseMode: indian.meta?.parseMode ?? "heuristic" },
    confidence: Math.min(0.95, ocrConfidence * 0.85),
    warnings: [...indian.warnings],
  };

  try {
    const ai = await extractWithOpenAi(rawText, documentType, companyGstin);
    if (ai && (ai.items.length > 0 || ai.total !== undefined || ai.partyName)) {
      const labeledTotal = pickBestDocumentTotal(rawText);
      const mergedTotal = mergeTotalsPreferPlausible(
        labeledTotal ?? indian.total,
        mergeTotalsPreferPlausible(indian.total, ai.total),
      );
      const aiItemsPlausible =
        ai.items.length > 0 &&
        !ai.items.every((it) => /receipt\s*total|^line\s*\d+$/i.test(it.name.trim()));

      merged = {
        ...indian,
        ...ai,
        total: mergedTotal ?? ai.total ?? indian.total,
        subtotal: ai.subtotal ?? indian.subtotal,
        items: aiItemsPlausible && ai.items.length ? ai.items : indian.items,
        partyGstin: ai.partyGstin ?? indian.partyGstin,
        invoiceDate: ai.invoiceDate ?? indian.invoiceDate,
        dueDate: ai.dueDate ?? indian.dueDate,
        invoiceNo: ai.invoiceNo ?? indian.invoiceNo,
        partyName: ai.partyName && !lineLooksLikeInvoiceNumber(ai.partyName) ? ai.partyName : indian.partyName,
        cgst: ai.cgst ?? indian.cgst,
        sgst: ai.sgst ?? indian.sgst,
        igst: ai.igst ?? indian.igst,
        warnings: [...new Set([...(indian.warnings ?? []), ...(ai.warnings ?? [])])],
        confidence: Math.min(0.95, ocrConfidence * 0.92),
        meta: { ...indian.meta, ...ai.meta, parseMode: "openai", ocrEngine: textEngine },
      };
    }
  } catch (e) {
    console.warn("AI merge skipped:", e);
  }

  merged = validateAndReconcileExtraction(merged);

  if (merged.items.length === 0) {
    merged.warnings.push("No line items detected — add lines manually.");
  }
  if (!merged.partyGstin) {
    merged.warnings.push("Tax ID / GSTIN not detected — place-of-supply / tax split may default to intra-state.");
  } else if (!isIndianGstin15(merged.partyGstin)) {
    merged.warnings.push("Non-Indian tax registration detected — verify CGST/SGST/IGST fields manually.");
  }

  return merged;
}
