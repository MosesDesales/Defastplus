import { parseYmd } from "@/lib/dates";

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** e.g. "09 Feb 2026", "9-Feb-2026", "Feb 9, 2026" */
function parseMonthNameDate(raw: string): Date | null {
  const t = raw.trim();
  let m = /^(\d{1,2})[\s\-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]+(\d{4})$/i.exec(t);
  if (m) {
    const day = parseInt(m[1]!, 10);
    const mo = MONTH_NAMES[m[2]!.toLowerCase().slice(0, 3) as keyof typeof MONTH_NAMES] ?? -1;
    const y = parseInt(m[3]!, 10);
    if (mo >= 0 && day >= 1 && day <= 31 && y >= 1900) return new Date(y, mo, day, 12, 0, 0, 0);
  }
  m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]+(\d{1,2}),?\s+(\d{4})$/i.exec(t);
  if (m) {
    const mo = MONTH_NAMES[m[1]!.toLowerCase().slice(0, 3) as keyof typeof MONTH_NAMES] ?? -1;
    const day = parseInt(m[2]!, 10);
    const y = parseInt(m[3]!, 10);
    if (mo >= 0 && day >= 1 && day <= 31 && y >= 1900) return new Date(y, mo, day, 12, 0, 0, 0);
  }
  return null;
}

export function parseFlexibleDate(raw: string): Date {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return parseYmd(t);
  const named = parseMonthNameDate(t);
  if (named) return named;
  const s = t.split(" ")[0] ?? "";
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (m) {
    const d = parseInt(m[1]!, 10);
    const mo = parseInt(m[2]!, 10);
    let y = parseInt(m[3]!, 10);
    if (y < 100) y += 2000;
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? new Date(NaN) : new Date(ms);
}

export type ParsedBankRow = {
  txnDate: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickCol(headers: string[], candidates: string[]): number | null {
  const n = headers.map(normHeader);
  for (const c of candidates) {
    const idx = n.indexOf(c);
    if (idx >= 0) return idx;
  }
  return null;
}

export function parseMoney(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const cleaned = t.replace(/[₹$,]/g, "").replace(/\s+/g, "");
  const neg = /^\(.*\)$/.test(cleaned);
  const n = parseFloat(cleaned.replace(/[()]/g, "").replace(/,/g, ""));
  if (Number.isNaN(n)) return 0;
  return neg ? -n : n;
}

export type CsvColumnMap = {
  date: number;
  description: number;
  debit?: number;
  credit?: number;
  amount?: number;
  balance?: number;
  reference?: number;
};

export function detectCsvDelim(firstLine: string): "\t" | "," {
  return firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
}

export function splitCsvLine(line: string, delim: "\t" | ","): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      q = !q;
      continue;
    }
    if ((delim === "\t" ? ch === "\t" : ch === ",") && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, "").trim());
}

function rowFromMappedColumns(cols: string[], map: CsvColumnMap): ParsedBankRow | null {
  const ds = cols[map.date] ?? "";
  const txnDate = parseFlexibleDate(ds);
  if (Number.isNaN(txnDate.getTime())) return null;

  const description = (cols[map.description] ?? "").trim() || "(no description)";
  let debit = 0;
  let credit = 0;
  if (map.amount != null) {
    const amt = parseMoney(cols[map.amount] ?? "");
    if (amt < 0) debit = Math.abs(amt);
    else if (amt > 0) credit = amt;
  } else {
    if (map.debit != null && cols[map.debit]) debit = Math.abs(parseMoney(cols[map.debit] ?? "0"));
    if (map.credit != null && cols[map.credit]) credit = Math.abs(parseMoney(cols[map.credit] ?? "0"));
  }
  const balanceRaw =
    map.balance != null && cols[map.balance] !== undefined && cols[map.balance] !== ""
      ? parseMoney(cols[map.balance] ?? "")
      : null;
  const reference =
    map.reference != null && cols[map.reference] ? cols[map.reference]!.trim() : null;

  if (debit <= 0 && credit <= 0) return null;
  return {
    txnDate,
    description,
    debit,
    credit,
    balance: balanceRaw != null && Number.isFinite(balanceRaw) ? balanceRaw : null,
    reference,
  };
}

/** Parse CSV using explicit zero-based column indices (from column mapping UI). */
export function parseBankStatementCsvWithColumnMap(csvText: string, map: CsvColumnMap): ParsedBankRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delim = detectCsvDelim(lines[0]!);
  const rows: ParsedBankRow[] = [];
  for (const line of lines) {
    const cols = splitCsvLine(line, delim);
    const row = rowFromMappedColumns(cols, map);
    if (row) rows.push(row);
  }
  return rows;
}

/** Parse a rectangular table (e.g. Excel) with header at `headerRowIndex`; data rows follow by default. */
export function parseBankTableWithColumnMap(
  table: string[][],
  headerRowIndex: number,
  map: CsvColumnMap,
  options?: { dataStartOffset?: number },
): ParsedBankRow[] {
  const dataStartOffset = options?.dataStartOffset ?? 1;
  const start = headerRowIndex + dataStartOffset;
  const rows: ParsedBankRow[] = [];
  for (let i = start; i < table.length; i++) {
    const raw = table[i] ?? [];
    const cols = raw.map((c) => (c ?? "").trim());
    const row = rowFromMappedColumns(cols, map);
    if (row) rows.push(row);
  }
  return rows;
}

/** Heuristic CSV parser for common bank export layouts. */
export function parseBankStatementCsv(csvText: string): ParsedBankRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delim = detectCsvDelim(lines[0]!);
  const split = (line: string) => splitCsvLine(line, delim);

  const headers = split(lines[0]!);
  const iDate =
    pickCol(headers, ["date", "txn date", "transaction date", "value date", "posting date"]) ?? 0;
  const iDesc =
    pickCol(headers, ["description", "narration", "particulars", "remarks", "details"]) ??
    Math.min(1, headers.length - 1);
  const iDebit = pickCol(headers, ["debit", "withdrawal", "withdrawals", "dr", "paid out"]);
  const iCredit = pickCol(headers, ["credit", "deposit", "deposits", "cr", "paid in"]);
  const iBal = pickCol(headers, ["balance", "closing balance", "running balance"]);
  const iRef = pickCol(headers, ["reference", "ref no", "ref", "cheque no", "transaction id", "utr"]);

  const rows: ParsedBankRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = split(lines[li]!);
    if (!cols.length) continue;
    const ds = cols[iDate] ?? "";
    const txnDate = parseFlexibleDate(ds);
    if (Number.isNaN(txnDate.getTime())) continue;

    const description = (cols[iDesc] ?? "").trim() || "(no description)";
    let debit = 0;
    let credit = 0;
    if (iDebit != null && cols[iDebit]) debit = Math.abs(parseMoney(cols[iDebit] ?? "0"));
    if (iCredit != null && cols[iCredit]) credit = Math.abs(parseMoney(cols[iCredit] ?? "0"));
    if (iDebit == null && iCredit == null) {
      const amt = parseMoney(cols[2] ?? "0");
      if (amt < 0) debit = Math.abs(amt);
      else if (amt > 0) credit = amt;
    }
    const balance =
      iBal != null && cols[iBal] !== undefined && cols[iBal] !== "" ? parseMoney(cols[iBal] ?? "") : null;
    const reference = iRef != null && cols[iRef] ? cols[iRef]!.trim() : null;

    if (debit <= 0 && credit <= 0) continue;
    rows.push({ txnDate, description, debit, credit, balance: Number.isFinite(balance) ? balance : null, reference });
  }
  return rows;
}
