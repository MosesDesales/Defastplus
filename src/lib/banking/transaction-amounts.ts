import type { BankingTransaction } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/** Positive bank inflow (customer receipt) vs outflow (payment). */
export function flowAmount(txn: Pick<BankingTransaction, "debit" | "credit">): number {
  const c = Number(txn.credit);
  const d = Number(txn.debit);
  if (c > 0.0001) return c;
  if (d > 0.0001) return d;
  return 0;
}

export function isInflow(txn: Pick<BankingTransaction, "debit" | "credit">): boolean {
  return Number(txn.credit) > Number(txn.debit);
}

export function appliedFromMappings(mappings: { amountApplied: Prisma.Decimal }[]): number {
  return mappings.reduce((s, m) => s + Number(m.amountApplied), 0);
}

export function remainingToMap(txn: Pick<BankingTransaction, "debit" | "credit">, applied: number): number {
  return Math.max(0, flowAmount(txn) - applied);
}
