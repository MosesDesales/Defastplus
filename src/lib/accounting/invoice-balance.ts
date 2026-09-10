import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getAllocatedTotalForInvoice(db: Db, invoiceId: string): Promise<number> {
  const agg = await db.paymentAllocation.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}
