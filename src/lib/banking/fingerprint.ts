import crypto from "crypto";

import type { ParsedBankRow } from "@/lib/banking/parse-csv";

function normDesc(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export function bankingTxnFingerprint(
  bankingAccountId: string,
  row: Pick<ParsedBankRow, "txnDate" | "description" | "debit" | "credit"> & { reference?: string | null },
): string {
  const d = row.txnDate.toISOString().slice(0, 10);
  const ref = (row.reference ?? "").trim().toLowerCase().slice(0, 64);
  const payload = `${bankingAccountId}|${d}|${row.debit.toFixed(2)}|${row.credit.toFixed(2)}|${normDesc(row.description)}|${ref}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
