import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DbClient = Prisma.TransactionClient | typeof prisma;

/** Ensures a default warehouse exists (named "Main") for opening stock and adjustments. */
export async function ensureDefaultWarehouse(db: DbClient, userId: string) {
  const existingDefault = await db.warehouse.findFirst({
    where: { userId, isDefault: true },
  });
  if (existingDefault) return existingDefault;

  const first = await db.warehouse.findFirst({ where: { userId } });
  if (first) {
    await db.warehouse.updateMany({ where: { userId }, data: { isDefault: false } });
    return db.warehouse.update({
      where: { id: first.id },
      data: { isDefault: true },
    });
  }

  return db.warehouse.create({
    data: { userId, name: "Main", isDefault: true },
  });
}

export async function ensureInventorySettings(db: DbClient, userId: string) {
  const row = await db.inventorySettings.findUnique({ where: { userId } });
  if (row) return row;
  return db.inventorySettings.create({
    data: { userId },
  });
}

export async function suggestSku(userId: string, txn?: Prisma.TransactionClient) {
  const db = txn ?? prisma;
  const n = await db.item.count({ where: { userId } });
  return `SKU-${String(n + 1).padStart(5, "0")}`;
}

export function totalStockQty(stocks: { quantity: Prisma.Decimal }[]): number {
  return stocks.reduce((s, r) => s + Number(r.quantity), 0);
}
