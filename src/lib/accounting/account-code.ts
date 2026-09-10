import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TYPE_START: Record<AccountType, number> = {
  ASSET: 1000,
  LIABILITY: 2000,
  EQUITY: 3000,
  INCOME: 4000,
  EXPENSE: 5000,
};

/** Next numeric code in range for account type (increment by 10). */
export async function suggestAccountCode(userId: string, type: AccountType): Promise<string> {
  const start = TYPE_START[type];
  const end = start + 999;
  const accounts = await prisma.account.findMany({
    where: { userId, type },
    select: { code: true },
  });
  let max = start;
  for (const a of accounts) {
    const n = Number.parseInt(a.code.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n >= start && n <= end && n > max) max = n;
  }
  return String(max + 10);
}
