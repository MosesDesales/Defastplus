import type { ParsedBankRow } from "@/lib/banking/parse-csv";
import { parseFlexibleDate } from "@/lib/banking/parse-csv";

/**
 * PDF/OCR bank statement parsing (Node). Uses date-delimited blocks and column-ordered
 * tail lines: Withdrawal (Dr.) | Deposit (Cr.) | Balance. True PDF table extraction
 * (e.g. pdfplumber / Tabula) is not wired here—those run in Python; this path targets
 * text-layer PDFs and OCR dumps where amounts appear on separate lines or glued at EOL.
 */
const GLUED_MONTH_DATE = /(?<=\d)(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i;
const START_MONTH_DATE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i;

const TOL = 0.05;

export type PlainTextParseResult = {
  rows: ParsedBankRow[];
  warnings: string[];
};

function parseMoney(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const cleaned = t.replace(/[₹$\s]/g, "").replace(/,/g, "");
  const neg = /^\(.*\)$/.test(cleaned);
  const n = parseFloat(cleaned.replace(/[()]/g, ""));
  if (Number.isNaN(n)) return 0;
  return neg ? -n : n;
}

/** Normalize OCR: spaces, commas inside numbers handled at parse time. */
export function normalizeOcrText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ \u3000]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function isMoneyOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^\s*[\d,]+\.\d{2}\s*(cr|dr|cr\.|dr\.)?\s*$/i.test(t);
}

function lineLooksLikeTxnStart(line: string): boolean {
  const t = line.trim();
  if (t.length < 8) return false;
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(t)) return true;
  if (GLUED_MONTH_DATE.test(t)) return true;
  if (START_MONTH_DATE.test(t)) return true;
  return false;
}

/** Split raw lines into blocks; each block starts with a line containing a transaction date. */
function splitIntoTxnBlocks(rawLines: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const raw of rawLines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      if (cur.length) cur.push(line);
      continue;
    }
    if (lineLooksLikeTxnStart(t)) {
      if (cur.length) blocks.push(cur);
      cur = [line];
    } else if (cur.length) {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

function findTxnDate(line: string): { date: Date; rest: string } | null {
  const t = line.trim();

  const slash = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/.exec(t);
  if (slash) {
    const d = parseFlexibleDate(slash[1]!);
    if (!Number.isNaN(d.getTime())) return { date: d, rest: t.slice(slash[0].length).trim() };
  }

  const gm = GLUED_MONTH_DATE.exec(t);
  if (gm) {
    const ds = `${gm[1]} ${gm[2]} ${gm[3]}`;
    const d = parseFlexibleDate(ds);
    if (!Number.isNaN(d.getTime())) {
      const prefix = t.slice(0, gm.index!).trim();
      const suffix = t.slice(gm.index! + gm[0].length).trim();
      const rest = /^\d{1,4}$/.test(prefix) ? suffix : [prefix, suffix].filter(Boolean).join(" ").trim();
      return { date: d, rest: rest || suffix };
    }
  }

  const sm = START_MONTH_DATE.exec(t);
  if (sm) {
    const ds = `${sm[1]} ${sm[2]} ${sm[3]}`;
    const d = parseFlexibleDate(ds);
    if (!Number.isNaN(d.getTime())) return { date: d, rest: t.slice(sm[0].length).trim() };
  }

  return null;
}

/** Peel amounts from end of a single string (glued PDF: …500.006,187.80). */
function peelLastMoneyDecimal(s: string): { value: number; rest: string } | null {
  const t = s.trimEnd();
  if (!t.length) return null;
  const westernThousands = /(\d{1,3}(?:,\d{3})+\.\d{2})$/.exec(t);
  if (westernThousands) {
    const raw = westernThousands[1]!;
    return { value: parseMoney(raw), rest: t.slice(0, westernThousands.index!).trimEnd() };
  }
  const simple = /(\d+\.\d{2})$/.exec(t);
  if (simple) {
    const raw = simple[1]!;
    return { value: parseMoney(raw), rest: t.slice(0, simple.index!).trimEnd() };
  }
  return null;
}

function extractTrailingAmountsFromString(rest: string): { amounts: number[]; narrative: string } {
  const amounts: number[] = [];
  let s = rest.trim();
  for (let n = 0; n < 8 && s.length > 0; n++) {
    const p = peelLastMoneyDecimal(s);
    if (!p) break;
    amounts.push(p.value);
    s = p.rest;
  }
  amounts.reverse();
  return { amounts, narrative: s.trim() };
}

function inferFlowKind(narrative: string): "debit" | "credit" | "unknown" {
  const n = narrative.toLowerCase();
  const creditHints =
    /\b(received|rcvd|credited|credit|deposit|salary|refund|dividend|interest(\s*credited)?|inward|cash\s*back)\b/i.test(
      narrative,
    ) ||
    /\b(neft|rtgs|imps)\s*[-/]?\s*cr\b/i.test(n) ||
    /\b(by transfer cr|from\s+[a-z].*cr)\b/i.test(n) ||
    /\bcr\s*\.?\s*$/i.test(n.trim()) ||
    /\/(rec|received)\b/i.test(n);
  const debitHints =
    /\b(sent|paid|debit|withdraw|withdrawal|purchase|payment\s+(to|made|sent)|outward|nfs|atm\s*wdl|atm\s*withdrawal|charges?|fee)\b/i.test(
      narrative,
    ) ||
    /\b(neft|rtgs|imps)\s*[-/]?\s*dr\b/i.test(n) ||
    /\b(by transfer dr|to transfer)\b/i.test(n) ||
    /\bpos\b/i.test(n) ||
    /\bdr\s*\.?\s*$/i.test(n.trim()) ||
    /\/(no|na)\b.*\bsent\b/i.test(n) ||
    /\bsent\s+using\b/i.test(n);
  if (creditHints && !debitHints) return "credit";
  if (debitHints && !creditHints) return "debit";
  if (creditHints && debitHints) return "unknown";
  if (/\bsent\b/i.test(narrative)) return "debit";
  if (/\breceived\b|\brcvd\b/i.test(narrative)) return "credit";
  return "unknown";
}

function resolveTwoColumnAmounts(
  a: number,
  balance: number,
  prevBalance: number | null,
  narrative: string,
): { debit: number; credit: number; balance: number; ambiguous: boolean } {
  if (prevBalance == null) {
    const hint = inferFlowKind(narrative);
    if (hint === "credit") return { debit: 0, credit: a, balance, ambiguous: false };
    if (hint === "debit") return { debit: a, credit: 0, balance, ambiguous: false };
    return { debit: 0, credit: a, balance, ambiguous: true };
  }
  const asDebit = prevBalance - a;
  const asCredit = prevBalance + a;
  const errDr = Math.abs(asDebit - balance);
  const errCr = Math.abs(asCredit - balance);
  if (errDr < TOL && errCr >= TOL) return { debit: a, credit: 0, balance, ambiguous: false };
  if (errCr < TOL && errDr >= TOL) return { debit: 0, credit: a, balance, ambiguous: false };
  if (errDr <= errCr) return { debit: a, credit: 0, balance, ambiguous: errDr >= TOL };
  return { debit: 0, credit: a, balance, ambiguous: errCr >= TOL };
}

function extractReferenceAndDescription(textLines: string[]): { reference: string | null; description: string } {
  const desc: string[] = [];
  let reference: string | null = null;
  for (const raw of textLines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^UPI[-/][\w@./-]+$/i.test(t) || /^UPI[-/]?\d{9,}$/i.test(t)) {
      reference = reference ?? t;
      continue;
    }
    if (/^(ref|reference|chq|cheque|utr)\s*[:#]?\s*/i.test(t)) {
      reference = reference ?? t.replace(/^(ref|reference|chq|cheque|utr)\s*[:#]?\s*/i, "").trim();
      continue;
    }
    desc.push(t);
  }
  return {
    reference,
    description: desc.join(" ").trim() || "(no description)",
  };
}

function parseColumnStackBody(
  bodyLines: string[],
  txnDate: Date,
  prevBalance: number | null,
): { row: ParsedBankRow | null; warnings: string[] } {
  const w: string[] = [];
  const body = [...bodyLines];
  while (body.length && !body[body.length - 1]!.trim()) body.pop();

  let i = body.length - 1;
  const tailVals: number[] = [];
  while (i >= 0) {
    const ln = body[i]!.trim();
    if (ln === "") {
      i--;
      continue;
    }
    if (isMoneyOnlyLine(ln)) {
      tailVals.unshift(parseMoney(ln));
      i--;
    } else break;
  }
  const textLines = body.slice(0, i + 1);
  const { reference, description } = extractReferenceAndDescription(textLines);

  if (tailVals.length === 0) return { row: null, warnings: w };

  let debit = 0;
  let credit = 0;
  let balance: number | null = null;

  if (tailVals.length >= 3) {
    debit = tailVals[0]! || 0;
    credit = tailVals[1]! || 0;
    balance = tailVals[2]!;
  } else if (tailVals.length === 2) {
    const res = resolveTwoColumnAmounts(tailVals[0]!, tailVals[1]!, prevBalance, description);
    debit = res.debit;
    credit = res.credit;
    balance = res.balance;
    if (res.ambiguous) {
      w.push(
        `Ambiguous Dr/Cr for ${txnDate.toISOString().slice(0, 10)} — ${description.slice(0, 48)}… (balance equation did not match cleanly).`,
      );
    }
  } else if (tailVals.length === 1) {
    w.push(
      `Skipping ${txnDate.toISOString().slice(0, 10)}: only one numeric line in amount block (expected Withdrawal / Deposit / Balance).`,
    );
    return { row: null, warnings: w };
  }

  if (debit <= 0 && credit <= 0) return { row: null, warnings: w };

  if (prevBalance != null && balance != null) {
    const expected = prevBalance - debit + credit;
    if (Math.abs(expected - balance) > TOL) {
      w.push(
        `Balance mismatch ${txnDate.toISOString().slice(0, 10)}: expected ${expected.toFixed(2)} (= previous ${prevBalance.toFixed(2)} − Dr ${debit.toFixed(2)} + Cr ${credit.toFixed(2)}), statement shows ${balance.toFixed(2)}.`,
      );
    }
  }

  return {
    row: {
      txnDate,
      description,
      debit,
      credit,
      balance: balance != null && Number.isFinite(balance) ? balance : null,
      reference,
    },
    warnings: w,
  };
}

function parseOneBlock(block: string[], prevBalance: number | null): { row: ParsedBankRow | null; warnings: string[] } {
  const w: string[] = [];
  if (!block.length) return { row: null, warnings: w };

  const first = block[0]!.trim();
  const found = findTxnDate(first);
  if (!found) return { row: null, warnings: w };

  const headRest = found.rest.trim();
  const bodyLines: string[] = [];
  if (headRest) bodyLines.push(headRest);
  for (let bi = 1; bi < block.length; bi++) bodyLines.push(block[bi]!.trimEnd());

  const joined = bodyLines.map((l) => l.trim()).join("\n");
  const hasSeparateMoneyLines = bodyLines.some((l) => l.trim() !== "" && isMoneyOnlyLine(l));

  if (hasSeparateMoneyLines) {
    return parseColumnStackBody(bodyLines, found.date, prevBalance);
  }

  const { amounts, narrative } = extractTrailingAmountsFromString(joined);
  if (amounts.length === 0 || !narrative.trim()) return { row: null, warnings: w };

  const { reference, description } = extractReferenceAndDescription(narrative.split(/\n/).map((s) => s.trim()));

  let debit = 0;
  let credit = 0;
  let balance: number | null = null;

  if (amounts.length >= 3) {
    debit = amounts[0]! || 0;
    credit = amounts[1]! || 0;
    balance = amounts[2]!;
  } else if (amounts.length === 2) {
    const r = resolveTwoColumnAmounts(amounts[0]!, amounts[1]!, prevBalance, description);
    debit = r.debit;
    credit = r.credit;
    balance = r.balance;
    if (r.ambiguous)
      w.push(
        `Ambiguous Dr/Cr (inline amounts) ${found.date.toISOString().slice(0, 10)} — ${description.slice(0, 48)}…`,
      );
  } else if (amounts.length === 1) {
    const a = amounts[0]!;
    const hint = inferFlowKind(description);
    if (hint === "credit") {
      debit = 0;
      credit = a;
    } else if (hint === "debit") {
      debit = a;
      credit = 0;
    } else {
      debit = a;
      credit = 0;
      w.push("Single inline amount with no balance column — assumed withdrawal.");
    }
    balance = null;
  }

  if (prevBalance != null && balance != null) {
    const expected = prevBalance - debit + credit;
    if (Math.abs(expected - balance) > TOL) {
      w.push(
        `Balance mismatch ${found.date.toISOString().slice(0, 10)}: expected ${expected.toFixed(2)}, saw ${balance?.toFixed(2) ?? "—"}.`,
      );
    }
  }

  if (debit <= 0 && credit <= 0) return { row: null, warnings: w };

  return {
    row: {
      txnDate: found.date,
      description: description || narrative.trim() || "(no description)",
      debit,
      credit,
      balance: balance != null && Number.isFinite(balance) ? balance : null,
      reference,
    },
    warnings: w,
  };
}

/**
 * Parse OCR / PDF-extracted plain text using date-delimited blocks and
 * column order: Withdrawal (Dr.) | Deposit (Cr.) | Balance.
 */
export function parseTransactionsFromPlainText(text: string, _bankHint?: string): PlainTextParseResult {
  const normalized = normalizeOcrText(text);
  const rawLines = normalized.split(/\n/);
  const blocks = splitIntoTxnBlocks(rawLines);
  const rows: ParsedBankRow[] = [];
  const warnings: string[] = [];
  let prevBalance: number | null = null;

  for (const block of blocks) {
    const { row, warnings: rw } = parseOneBlock(block, prevBalance);
    warnings.push(...rw);
    if (row) {
      rows.push(row);
      if (row.balance != null && Number.isFinite(row.balance)) prevBalance = row.balance;
    }
  }

  return { rows, warnings };
}

/** Flag rows where running balance does not chain (±tolerance). */
export function validateRunningBalances(rows: ParsedBankRow[], openingGuess: number | null): string[] {
  const warnings: string[] = [];
  if (rows.length < 2 && openingGuess == null) return warnings;

  const indexed = rows.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    const d = a.r.txnDate.getTime() - b.r.txnDate.getTime();
    return d !== 0 ? d : a.i - b.i;
  });
  const sorted = indexed.map((x) => x.r);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (prev.balance == null || cur.balance == null) continue;
    const expected = prev.balance - prev.debit + prev.credit;
    if (Math.abs(expected - cur.balance!) > TOL) {
      warnings.push(
        `Statement chain: after ${prev.txnDate.toISOString().slice(0, 10)} expected balance ≈ ${expected.toFixed(2)}, next row shows ${cur.balance!.toFixed(2)} (${cur.description.slice(0, 40)}…).`,
      );
    }
  }
  if (openingGuess != null && sorted[0]?.balance != null) {
    const first = sorted[0]!;
    const impliedOpen = first.balance! + first.debit - first.credit;
    if (Math.abs(impliedOpen - openingGuess) > TOL) {
      warnings.push("First row balance may not match account opening balance.");
    }
  }
  return warnings;
}
