import { AccountType } from "@prisma/client";

export function isDebitNormal(type: AccountType): boolean {
  return type === AccountType.ASSET || type === AccountType.EXPENSE;
}

/** Opening amounts split into debit/credit columns (positive magnitudes). */
export function openingDebitCredit(type: AccountType, openingBalance: number): { debit: number; credit: number } {
  const o = Math.abs(openingBalance);
  if (isDebitNormal(type)) {
    return { debit: o, credit: 0 };
  }
  return { debit: 0, credit: o };
}

/** Running balance after each row (debit − credit convention). */
export function runningBalanceAfter(prev: number, debit: number, credit: number): number {
  return prev + debit - credit;
}
