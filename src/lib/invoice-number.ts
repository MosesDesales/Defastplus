import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getNextInvoiceNumber(userId: string, db: Db = prisma): Promise<string> {
  const rows = await db.invoice.findMany({
    where: { userId },
    select: { invoiceNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /^INV-(\d+)$/i.exec(r.invoiceNumber.trim());
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `INV-${String(max + 1).padStart(6, "0")}`;
}
