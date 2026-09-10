import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getNextChallanNumber(userId: string, db: Db = prisma): Promise<string> {
  const rows = await db.deliveryChallan.findMany({ where: { userId }, select: { challanNumber: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^DC-(\d+)$/i.exec(r.challanNumber.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DC-${String(max + 1).padStart(6, "0")}`;
}

export async function getNextPurchaseReturnNumber(userId: string, db: Db = prisma): Promise<string> {
  const rows = await db.purchaseReturn.findMany({ where: { userId }, select: { returnNumber: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^PR-(\d+)$/i.exec(r.returnNumber.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PR-${String(max + 1).padStart(6, "0")}`;
}
