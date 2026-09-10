/** Validate manual journal lines: one-sided amounts, balanced totals. */
export function validateManualJournalLines(
  lines: { debit: number; credit: number }[],
): string | null {
  let td = 0;
  let tc = 0;
  for (const l of lines) {
    const dr = round2(l.debit);
    const cr = round2(l.credit);
    if (dr < 0 || cr < 0) return "Debit and credit amounts must be zero or positive.";
    if (dr > 0 && cr > 0) return "Each line must have either debit or credit, not both.";
    td += dr;
    tc += cr;
  }
  if (Math.abs(td - tc) > 0.005) return `Out of balance: debits ${td.toFixed(2)} vs credits ${tc.toFixed(2)}.`;
  if (td === 0 && tc === 0) return "Journal totals cannot be zero.";
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
