/**
 * Heuristics to turn noisy OCR text from receipts into structured fields.
 * Works best on clear photos; results should always be reviewed by the user.
 */
import {
  extractCurrencyCandidatesLoose,
  extractStrictCurrencyAmounts,
  isBareLongIntegerToken,
  pickBestDocumentTotal,
} from "@/lib/ocr/normalize-money";

export type ParsedReceipt = {
  dateYmd?: string;
  /** Payment / due date when detected on a dedicated line. */
  dueDateYmd?: string;
  amount?: number;
  taxAmount?: number;
  merchantHint?: string;
  invoiceNumber?: string;
};

function parseDateToYmd(s: string): string | undefined {
  const t = s.trim();
  const dmy = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

const MONTH_TO_NUM: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseEnglishMonthDateLine(line: string): string | undefined {
  const m = line.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (!m) return undefined;
  const mon = m[1]!.toLowerCase();
  const month = MONTH_TO_NUM[mon] ?? MONTH_TO_NUM[mon.slice(0, 3)];
  if (!month) return undefined;
  const d = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31) return undefined;
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function extractDatesFromLine(line: string): string[] {
  const dates: string[] = [];
  const re = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;
  let m: RegExpExecArray | null = re.exec(line);
  while (m) {
    const ymd = parseDateToYmd(m[1]);
    if (ymd) dates.push(ymd);
    m = re.exec(line);
  }
  const eng = parseEnglishMonthDateLine(line);
  if (eng) dates.push(eng);
  return dates;
}

function normalizeAmount(raw: string): number | undefined {
  if (isBareLongIntegerToken(raw)) return undefined;
  const s = raw.replace(/[,\s]/g, "").replace(/^₹+|^INR|^[$]/i, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0 || n > 999_999_999) return undefined;
  return Math.round(n * 100) / 100;
}

const TOTAL_HINT =
  /(?:grand\s*total|^total\s*$|\btotal\b|\btotal\s*(?=₹|INR|\$)|total\s*[:]|total\s*amount|amount\s*payable|net\s*payable|balance\s*due|total\s*due|to\s*pay|payable|net\s*amount|invoice\s*total|amount\s*due)/i;

const ISSUE_DATE_HINT =
  /(?:invoice\s*date|invoice\s*issued|issue\s*date|bill\s*date|date\s*of\s*(?:issue|supply)|issued(?:\s*on)?|supply\s*date)/i;

const DUE_DATE_HINT = /(?:due\s*date|due\s*:|payment\s*due|pay\s*by|due\s*on)/i;

/** Prefer properly formatted currency on total lines. */
function extractMoneyTokensFromLine(line: string): number[] {
  const strict = extractStrictCurrencyAmounts(line);
  if (strict.length) return [...new Set(strict)];
  const loose = [...line.matchAll(/(?:₹\s*|\$\s*|INR\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/gi)]
    .map((m) => normalizeAmount(m[1]!))
    .filter((n): n is number => n !== undefined);
  return [...new Set(loose)];
}

function lineLooksLikeInvoiceNumber(line: string): boolean {
  const t = line.trim();
  return (
    /^INV[-\s./]?[A-Z0-9]{3,}$/i.test(t) ||
    /^BILL[-\s./]?[A-Z0-9]{3,}$/i.test(t) ||
    /^(?:invoice|inv\.?|bill)\s*[#:]?\s*[A-Z0-9][A-Z0-9\-/]{2,}$/i.test(t)
  );
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const block = lines.join("\n");

  const result: ParsedReceipt = {};

  const invPatterns: { re: RegExp; group: number }[] = [
    { re: /\b(?:invoice|bill)\s*(?:no\.?|number|#)\s*[.:]?\s*([A-Z0-9][A-Z0-9\-./]{2,40})\b/i, group: 1 },
    { re: /\b(?:invoice|bill)\s*#\s*([A-Z0-9][A-Z0-9\-./]{2,40})\b/i, group: 1 },
    { re: /\b(INV[-\s/]*\d[\dA-Z\-/]{2,})\b/i, group: 1 },
    { re: /\b(BILL[-\s/]*\d[\dA-Z\-/]{2,})\b/i, group: 1 },
    { re: /\b([A-Z]{2,}\d{2,}[A-Z0-9\-./]{0,20})\b/, group: 1 },
    { re: /(?:bill\s*no\.?|invoice\s*no\.?|inv\.?\s*no\.?)\s*[.:]?\s*([A-Z0-9][A-Z0-9\-/]{2,40})/i, group: 1 },
    { re: /(?:invoice|bill)\s*[#:]\s*([A-Z0-9][A-Z0-9\-/]{2,40})/i, group: 1 },
  ];
  for (const { re, group } of invPatterns) {
    const m = block.match(re);
    const cap = m?.[group]?.trim();
    if (cap && !/^(date|total|amount|number)$/i.test(cap) && !/^page\s+\d+/i.test(cap)) {
      result.invoiceNumber = cap.slice(0, 120);
      break;
    }
  }

  for (let i = 0; i < lines.length - 1; i++) {
    if (!/\b(?:invoice|bill)\s*(?:no\.?|number)\b/i.test(lines[i]!)) continue;
    const next = lines[i + 1]?.trim();
    if (next && /^[A-Z0-9][A-Z0-9\-./]{2,40}$/i.test(next)) {
      result.invoiceNumber = next.slice(0, 120);
      break;
    }
  }

  const issueDates: string[] = [];
  const dueDates: string[] = [];

  for (const line of lines) {
    const fromLine = extractDatesFromLine(line);
    if (!fromLine.length) continue;
    if (DUE_DATE_HINT.test(line)) {
      dueDates.push(...fromLine);
    } else if (ISSUE_DATE_HINT.test(line) || (/^\s*date\s*:/i.test(line) && !/due/i.test(line))) {
      issueDates.push(...fromLine);
    }
  }

  if (issueDates.length === 0) {
    for (const line of lines) {
      if (!/date|issued/i.test(line) || DUE_DATE_HINT.test(line)) continue;
      issueDates.push(...extractDatesFromLine(line));
    }
  }

  if (dueDates.length === 0) {
    for (const line of lines) {
      if (!DUE_DATE_HINT.test(line)) continue;
      dueDates.push(...extractDatesFromLine(line));
    }
  }

  const allDates = extractDatesFromLine(block);
  if (issueDates.length === 0 && allDates.length > 0) {
    if (dueDates.length > 0) {
      const firstDue = dueDates[0];
      result.dueDateYmd = firstDue;
      const beforeDue = allDates.filter((d) => d !== firstDue);
      result.dateYmd = beforeDue[0] ?? allDates[0];
    } else if (allDates.length >= 2) {
      result.dateYmd = allDates[0];
      result.dueDateYmd = allDates[allDates.length - 1];
    } else {
      result.dateYmd = allDates[0];
    }
  } else {
    result.dateYmd = issueDates[0];
    if (dueDates.length > 0) result.dueDateYmd = dueDates[0];
    else {
      const extra = allDates.find((d) => d !== result.dateYmd);
      if (extra) result.dueDateYmd = extra;
    }
  }

  const labeledTotal = pickBestDocumentTotal(block);
  if (labeledTotal !== undefined) {
    result.amount = labeledTotal;
  } else {
    let bestTotal: number | undefined;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!TOTAL_HINT.test(line)) continue;
      const local = extractMoneyTokensFromLine(line);
      if (local.length) {
        bestTotal = local[local.length - 1];
        break;
      }
    }

    if (bestTotal === undefined) {
      const loose = extractCurrencyCandidatesLoose(block);
      if (loose.length) {
        const sorted = [...new Set(loose)].sort((a, b) => b - a);
        const subtotalHint = block.match(/\bsub\s*-?\s*total\b/i);
        const candidates = sorted.filter((n) => n < 10_000_000);
        if (subtotalHint && candidates.length >= 2) {
          bestTotal = candidates[0];
          const second = candidates[1]!;
          if (bestTotal > second * 4 && second > 0) {
            bestTotal = second;
          }
        } else {
          bestTotal = candidates[0];
        }
      }
    }

    if (bestTotal !== undefined) {
      result.amount = bestTotal;
    }
  }

  for (const line of lines.slice(0, 20)) {
    if (line.length < 4) continue;
    if (!/[A-Za-z]{2,}/.test(line)) continue;
    if (/^page\s+\d+\s+of\s+\d+$/i.test(line)) continue;
    if (lineLooksLikeInvoiceNumber(line)) continue;
    if (result.invoiceNumber && line.includes(result.invoiceNumber)) continue;
    if (/^[\d\s₹,.-]+$/.test(line)) continue;
    if (/tax\s*invoice|credit\s*note|original|duplicate|e-?way/i.test(line)) continue;
    if (/\b(?:order|ord\.?)\s*(?:nr|no|#)/i.test(line)) continue;
    if (/^(?:date|issue|due)\b/i.test(line)) continue;
    if (/date\s*of\s*issue/i.test(line)) continue;
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(line)) continue;
    if (/tax|gst|amount|total|bill|qty|rate|hsn|sac|cgst|sgst|igst|thank/i.test(line)) continue;
    result.merchantHint = line.slice(0, 200);
    break;
  }

  return result;
}
