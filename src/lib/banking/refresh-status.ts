import { BankingTransactionStatus, type PrismaClient } from "@prisma/client";

import { appliedFromMappings, flowAmount } from "@/lib/banking/transaction-amounts";

type Db = PrismaClient | import("@prisma/client").Prisma.TransactionClient;

export async function refreshBankingTransactionStatus(db: Db, bankingTransactionId: string): Promise<void> {
  const t = await db.bankingTransaction.findUnique({
    where: { id: bankingTransactionId },
    include: { mappings: true },
  });
  if (!t) return;
  const applied = appliedFromMappings(t.mappings);
  const flow = flowAmount(t);
  let status: BankingTransactionStatus = BankingTransactionStatus.UNMAPPED;
  if (flow <= 0.0001) {
    status = BankingTransactionStatus.RECONCILED;
  } else if (applied + 0.005 >= flow) {
    status = BankingTransactionStatus.RECONCILED;
  } else if (applied > 0.005) {
    status = BankingTransactionStatus.PARTIALLY_MAPPED;
  }
  await db.bankingTransaction.update({ where: { id: bankingTransactionId }, data: { status } });
}
