/**
 * Column mapping for spreadsheet bank statements (Excel and CSV). Pure and client-safe:
 * the upload wizard re-parses live as the user picks headings, and the parse API reuses it.
 */
import { parseMoney, type ParsedBankRow } from "@/lib/banking/parse-csv";

export type DateFormat = "auto" | "DMY" | "MDY" | "YMD";
export type AmountLayout = "split" | "single" | "single_drcr";

export type StatementMapping = {
  headerRowIndex: number;
  date: number | null;
  description: number | null;
  /** Optional second column appended to the description (e.g. "Chq/Ref No." or "Remarks"). */
  description2: number | null;
  amountLayout: AmountLayout;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  /** Column holding "Dr"/"Cr" (or "Debit"/"Credit", "D"/"C") for `single_drcr`. */
  drCr: number | null;
  /** For `single`: whether a negative amount is money out (most banks) or money in. */
  negativeIs: "debit" | "credit";
  balance: number | null;
  reference: number | null;
  dateFormat: DateFormat;
};

export type MappableField = "date" | "description" | "description2" | "debit" | "credit" | "amount" | "drCr" | "balance" | "reference";

export type ColumnOption = { index: number; letter: string; heading: string; sample: string };

/** Excel-style column letter: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const HEADER_HINT =
  /date|value\s*dt|txn|transaction|posting|narration|particulars|description|details|debit|credit|withdraw|deposit|balance|amount|ref|chq|cheque/i;

/** First row (within the top 30) that looks like column headings. */
export function suggestHeaderRow(table: string[][]): number {
  let best = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const cells = (table[i] ?? []).filter((c) => c?.trim());
    const score = cells.filter((c) => HEADER_HINT.test(c) && c.length < 40).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
    if (score >= 3) return i;
  }
  return best;
}

/** Dropdown options for a header row: heading text (or "Column X") plus a sample value from below it. */
export function columnOptions(table: string[][], headerRowIndex: number): ColumnOption[] {
  const header = table[headerRowIndex] ?? [];
  const width = Math.max(header.length, ...table.slice(headerRowIndex, headerRowIndex + 40).map((r) => r.length), 0);
  const out: ColumnOption[] = [];
  for (let c = 0; c < width; c++) {
    let sample = "";
    for (let r = headerRowIndex + 1; r < Math.min(table.length, headerRowIndex + 40); r++) {
      const v = table[r]?.[c]?.trim();
      if (v) {
        sample = v;
        break;
      }
    }
    const heading = header[c]?.trim() ?? "";
    if (!heading && !sample) continue;
    out.push({ index: c, letter: columnLetter(c), heading: heading || `Column ${columnLetter(c)}`, sample });
  }
  return out;
}

function find(headers: string[], re: RegExp, exclude: (number | null)[] = []): number | null {
  const i = headers.findIndex((h, idx) => re.test(h) && !exclude.includes(idx));
  return i >= 0 ? i : null;
}

/** Best-guess mapping from the heading text (works for SBI, HDFC, ICICI, Axis, Kotak style exports). */
export function guessMapping(table: string[][], headerRowIndex = suggestHeaderRow(table)): StatementMapping {
  const h = (table[headerRowIndex] ?? []).map(norm);
  const date = find(h, /^(txn|tran|transaction|posting)?\s*date$|^date$|txn date|tran date|transaction date/) ?? find(h, /date/) ?? find(h, /value\s*dt/);
  const description = find(h, /narration|particular|description|details|remarks/, [date]);
  const reference = find(h, /chq|cheque|ref|utr|transaction id|instrument/, [date, description]);
  const debit = find(h, /withdraw|debit|^dr\.?$|paid out|dr amount/);
  const credit = find(h, /deposit|credit|^cr\.?$|paid in|cr amount/, [debit]);
  const drCr = find(h, /^(dr\s*\/\s*cr|cr\s*\/\s*dr|dr\/cr|type|txn type|d\/c|c\/d)$/);
  const amount = find(h, /amount|^amt\.?$/, [debit, credit, drCr]);
  const balance = find(h, /balance|closing/);
  const layout: AmountLayout = debit != null || credit != null ? "split" : drCr != null ? "single_drcr" : "single";
  return {
    headerRowIndex,
    date,
    description,
    description2: null,
    amountLayout: layout,
    debit: layout === "split" ? debit : null,
    credit: layout === "split" ? credit : null,
    amount: layout === "split" ? null : amount,
    drCr: layout === "single_drcr" ? drCr : null,
    negativeIs: "debit",
    balance,
    reference,
    dateFormat: "auto",
  };
}

/** Problems that stop parsing; empty when the mapping is usable. */
export function mappingErrors(m: StatementMapping): string[] {
  const errs: string[] = [];
  if (m.date == null) errs.push("Choose the Date column.");
  if (m.description == null) errs.push("Choose the Description column.");
  if (m.amountLayout === "split" && m.debit == null && m.credit == null) errs.push("Choose the Debit and/or Credit column.");
  if (m.amountLayout !== "split" && m.amount == null) errs.push("Choose the Amount column.");
  if (m.amountLayout === "single_drcr" && m.drCr == null) errs.push("Choose the Dr/Cr column.");
  return errs;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function mkDate(y: number, m: number, d: number): Date | null {
  if (y < 100) y += 2000;
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const dt = new Date(y, m, d, 12, 0, 0, 0);
  return dt.getMonth() === m ? dt : null;
}

/** Parses statement dates: ISO, Excel serial numbers, "09 Feb 2026", and numeric dates in the chosen order. */
export function parseStatementDate(raw: string, fmt: DateFormat = "auto"): Date | null {
  const t = raw.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return mkDate(+m[1]!, +m[2]! - 1, +m[3]!);
  // Excel serial date (days since 1899-12-30) in a cell without date formatting.
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serial = Math.floor(parseFloat(t));
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return mkDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
  }
  m = /^(\d{1,2})[\s\-\/.]+([A-Za-z]{3})[A-Za-z]*[\s\-\/.,]+(\d{2,4})/.exec(t);
  if (m && MONTHS[m[2]!.toLowerCase()] != null) return mkDate(+m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!);
  m = /^([A-Za-z]{3})[A-Za-z]*[\s\-.]+(\d{1,2}),?[\s\-.]+(\d{2,4})/.exec(t);
  if (m && MONTHS[m[1]!.toLowerCase()] != null) return mkDate(+m[3]!, MONTHS[m[1]!.toLowerCase()]!, +m[2]!);
  m = /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/.exec(t);
  if (m) {
    const [a, b, c] = [+m[1]!, +m[2]!, +m[3]!];
    if (m[1]!.length === 4 || fmt === "YMD") return mkDate(a, b - 1, c);
    if (fmt === "MDY") return mkDate(c, a - 1, b);
    if (fmt === "auto" && b > 12 && a <= 12) return mkDate(c, a - 1, b); // unambiguous MM/DD
    return mkDate(c, b - 1, a); // Indian default: DD/MM/YYYY
  }
  return null;
}

/** Reads an amount and any trailing/leading Dr/Cr marker ("1,250.00 Dr", "CR 500"). */
export function readAmount(raw: string): { value: number; marker: "debit" | "credit" | null } {
  const t = raw.trim();
  let marker: "debit" | "credit" | null = null;
  if (/\b(dr|debit|d)\.?$/i.test(t) || /^(dr|debit)\b/i.test(t)) marker = "debit";
  else if (/\b(cr|credit|c)\.?$/i.test(t) || /^(cr|credit)\b/i.test(t)) marker = "credit";
  const numeric = t.replace(/\b(dr|cr|debit|credit)\b\.?/gi, "").replace(/\s[dc]\.?$/i, "").replace(/inr|rs\.?/gi, "");
  return { value: parseMoney(numeric), marker };
}

function indicator(raw: string): "debit" | "credit" | null {
  const t = norm(raw).replace(/\./g, "");
  if (/^(dr|d|debit|withdrawal|w)$/.test(t)) return "debit";
  if (/^(cr|c|credit|deposit)$/.test(t)) return "credit";
  return null;
}

export type SkippedRow = { row: number; reason: string };
export type MappingResult = { rows: ParsedBankRow[]; skipped: SkippedRow[] };

/** Applies a mapping to every row under the header. Rows without a date or amount are skipped with a reason. */
export function parseWithMapping(table: string[][], m: StatementMapping): MappingResult {
  const rows: ParsedBankRow[] = [];
  const skipped: SkippedRow[] = [];
  if (mappingErrors(m).length) return { rows, skipped };
  const cell = (r: string[], i: number | null) => (i == null ? "" : (r[i] ?? "").trim());

  for (let i = m.headerRowIndex + 1; i < table.length; i++) {
    const r = table[i] ?? [];
    if (!r.some((c) => c?.trim())) continue; // blank line
    const rowNo = i + 1;
    const rawDate = cell(r, m.date);
    const txnDate = parseStatementDate(rawDate, m.dateFormat);
    if (!txnDate) {
      skipped.push({ row: rowNo, reason: rawDate ? `Unrecognised date "${rawDate.slice(0, 24)}"` : "No date" });
      continue;
    }
    let debit = 0;
    let credit = 0;
    if (m.amountLayout === "split") {
      debit = Math.abs(readAmount(cell(r, m.debit)).value);
      credit = Math.abs(readAmount(cell(r, m.credit)).value);
    } else {
      const { value, marker } = readAmount(cell(r, m.amount));
      const dir =
        m.amountLayout === "single_drcr"
          ? (indicator(cell(r, m.drCr)) ?? marker)
          : (marker ?? (value < 0 ? m.negativeIs : m.negativeIs === "debit" ? "credit" : "debit"));
      if (dir === "debit") debit = Math.abs(value);
      else if (dir === "credit") credit = Math.abs(value);
      else if (value !== 0) {
        skipped.push({ row: rowNo, reason: `No Dr/Cr marker for amount ${cell(r, m.amount)}` });
        continue;
      }
    }
    if (debit <= 0 && credit <= 0) {
      skipped.push({ row: rowNo, reason: "No amount (e.g. opening/closing balance line)" });
      continue;
    }
    const desc = [cell(r, m.description), m.description2 != null ? cell(r, m.description2) : ""].filter(Boolean).join(" — ");
    const balRaw = cell(r, m.balance);
    const bal = balRaw ? readAmount(balRaw) : null;
    rows.push({
      txnDate,
      description: desc || "(no description)",
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      balance: bal ? (bal.marker === "debit" ? -Math.abs(bal.value) : bal.value) : null,
      reference: cell(r, m.reference) || null,
    });
  }
  return { rows, skipped };
}

/** Identifies a statement layout by its headings, so a saved mapping is reused for the same bank format. */
export function headingSignature(table: string[][], headerRowIndex: number): string {
  return (table[headerRowIndex] ?? []).map(norm).filter(Boolean).join("|");
}
