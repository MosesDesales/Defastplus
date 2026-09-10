import { AccountType } from "@prisma/client";

/** Map Tally primary group names → ERP account classification. */
export const TALLY_GROUP_ACCOUNT_TYPE: Record<string, AccountType> = {
  "capital account": AccountType.EQUITY,
  "reserves & surplus": AccountType.EQUITY,
  "current assets": AccountType.ASSET,
  "fixed assets": AccountType.ASSET,
  "investments": AccountType.ASSET,
  "loans & advances (asset)": AccountType.ASSET,
  "loans and advances (asset)": AccountType.ASSET,
  "bank accounts": AccountType.ASSET,
  "bank od a/c": AccountType.LIABILITY,
  "cash-in-hand": AccountType.ASSET,
  "deposits (asset)": AccountType.ASSET,
  "stock-in-hand": AccountType.ASSET,
  "sundry debtors": AccountType.ASSET,
  "current liabilities": AccountType.LIABILITY,
  "duties & taxes": AccountType.LIABILITY,
  "duties and taxes": AccountType.LIABILITY,
  "provisions": AccountType.LIABILITY,
  "sundry creditors": AccountType.LIABILITY,
  "direct expenses": AccountType.EXPENSE,
  "indirect expenses": AccountType.EXPENSE,
  "direct incomes": AccountType.INCOME,
  "indirect incomes": AccountType.INCOME,
  "sales accounts": AccountType.INCOME,
  "purchase accounts": AccountType.EXPENSE,
  "branch / divisions": AccountType.EQUITY,
  "branch/divisions": AccountType.EQUITY,
  "misc. expenses (asset)": AccountType.ASSET,
  "suspense a/c": AccountType.LIABILITY,
};

export function isReservedTallyGroup(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n === "primary") return true;
  return Object.keys(TALLY_GROUP_ACCOUNT_TYPE).some((k) => k === n || name.trim() === k);
}

export function resolveAccountType(groupName: string | null | undefined, parentChain: string[]): AccountType {
  const candidates = [groupName, ...parentChain].filter(Boolean) as string[];
  for (const c of candidates) {
    const key = c.trim().toLowerCase();
    if (TALLY_GROUP_ACCOUNT_TYPE[key]) return TALLY_GROUP_ACCOUNT_TYPE[key]!;
    for (const [k, v] of Object.entries(TALLY_GROUP_ACCOUNT_TYPE)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }
  return AccountType.EXPENSE;
}

export function normalizeTallyKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function accountCodeFromTallyName(name: string, seq: number): string {
  const base = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `T${(base || "LY").slice(0, 8)}${String(seq).padStart(4, "0")}`;
}
