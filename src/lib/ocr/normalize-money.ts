/**
 * Parse currency amounts from OCR / PDF text without treating order IDs
 * (e.g. hb_49050517 → 49050517) as monetary totals.
 */

const STRICT_GROUPED = /\b(?:₹|INR\s*|\$\s*)?(\d{1,3}(?:,\d{3})+\.\d{2})\b/gi;
const GROUPED_NO_DECIMAL = /\b(?:₹|INR\s*|\$\s*)?(\d{1,3}(?:,\d{3})+)\b/gi;
const PLAIN_DECIMAL = /\b(?:₹|INR\s*|\$\s*)?(\d+\.\d{2})\b/gi;
const WHOLE_CURRENCY = /\b(?:₹|INR\s*|\$\s*)(\d{1,3}(?:,\d{3})*|\d{1,6})\b/gi;
const USD_SUFFIX = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD\b/gi;

function toNumber(raw: string): number | undefined {
  const s = raw.replace(/[₹$,\s]/gi, "").replace(/^INR/i, "").replace(/%$/, "").trim();
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0 || n > 999_999_999) return undefined;
  return Math.round(n * 100) / 100;
}

/** Long digit-only tokens (order numbers, OCR glue) are not currency. */
export function isBareLongIntegerToken(raw: string): boolean {
  const t = raw.replace(/[,\s₹$]/g, "");
  if (!/^\d+$/.test(t)) return false;
  return t.length >= 7;
}

/**
 * Amounts that look like real currency: grouped thousands and/or cents.
 */
export function extractStrictCurrencyAmounts(line: string): number[] {
  const out: number[] = [];
  const add = (raw: string) => {
    const n = toNumber(raw);
    if (n !== undefined) out.push(n);
  };
  for (const m of line.matchAll(STRICT_GROUPED)) add(m[1]!);
  for (const m of line.matchAll(PLAIN_DECIMAL)) {
    if (!m[1]!.includes(",") && isBareLongIntegerToken(m[1]!)) continue;
    add(m[1]!);
  }
  for (const m of line.matchAll(GROUPED_NO_DECIMAL)) {
    const raw = m[1]!;
    if (raw.includes(".")) continue;
    add(raw);
  }
  for (const m of line.matchAll(USD_SUFFIX)) add(m[1]!);
  for (const m of line.matchAll(WHOLE_CURRENCY)) {
    const raw = m[1]!;
    if (isBareLongIntegerToken(raw)) continue;
    add(raw);
  }
  return [...new Set(out)];
}

/**
 * Looser scan for fallback: still rejects bare 7+ digit integers without separators.
 */
export function extractCurrencyCandidatesLoose(block: string): number[] {
  const re = /(?:₹\s*|\$\s*|INR\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2})\b/gi;
  const out: number[] = [];
  for (const m of block.matchAll(re)) {
    const raw = m[1]!.trim();
    if (isBareLongIntegerToken(raw)) continue;
    const n = toNumber(raw);
    if (n !== undefined) out.push(n);
  }
  for (const m of block.matchAll(USD_SUFFIX)) {
    const n = toNumber(m[1]!);
    if (n !== undefined) out.push(n);
  }
  return [...new Set(out)];
}

/** Parse numeric tokens from a line, stripping common currency symbols. */
export function parseNumericTokens(tokens: string[]): number[] {
  return tokens
    .map((t) => Number.parseFloat(t.replace(/[$,₹]/g, "").replace(/%$/, "")))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

export type TotalLineKind = "amount_due" | "total" | "balance_due" | "subtotal" | "other";

const TOTAL_LINE_PATTERNS: { kind: TotalLineKind; weight: number; re: RegExp }[] = [
  { kind: "amount_due", weight: 100, re: /\bamount\s+due\b/i },
  { kind: "balance_due", weight: 90, re: /\bbalance\s+due\b/i },
  { kind: "total", weight: 80, re: /\b(?:grand\s+)?total\b/i },
  { kind: "subtotal", weight: 40, re: /\bsub\s*-?\s*total\b/i },
];

/** Score lines that declare document totals; higher weight wins, then bottom of doc. */
export function extractDocumentTotalsFromText(text: string): { amount: number; kind: TotalLineKind; lineIndex: number }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hits: { amount: number; kind: TotalLineKind; lineIndex: number; weight: number }[] = [];

  lines.forEach((line, lineIndex) => {
    const lower = line.toLowerCase();
    if (/page\s+\d+\s+of\s+\d+/i.test(line)) return;
    if (/^(qty|unit\s*price|description|item|rate|tax\s*%|sl\.?\s*no)/i.test(line)) return;

    let kind: TotalLineKind = "other";
    let weight = 0;
    for (const p of TOTAL_LINE_PATTERNS) {
      if (p.re.test(lower)) {
        kind = p.kind;
        weight = p.weight;
        break;
      }
    }
    if (weight === 0) return;

    const amounts = extractStrictCurrencyAmounts(line);
    if (!amounts.length) return;
    const amount = amounts[amounts.length - 1]!;
    hits.push({ amount, kind, lineIndex, weight });
  });

  return hits.map(({ amount, kind, lineIndex }) => ({ amount, kind, lineIndex }));
}

/** Pick the best declared total from labeled lines (prefers amount due, then bottom of page). */
export function pickBestDocumentTotal(text: string): number | undefined {
  const hits = extractDocumentTotalsFromText(text);
  if (!hits.length) return undefined;

  hits.sort((a, b) => {
    const pa = TOTAL_LINE_PATTERNS.find((p) => p.kind === a.kind)?.weight ?? 0;
    const pb = TOTAL_LINE_PATTERNS.find((p) => p.kind === b.kind)?.weight ?? 0;
    if (pb !== pa) return pb - pa;
    return b.lineIndex - a.lineIndex;
  });

  return hits[0]!.amount;
}
