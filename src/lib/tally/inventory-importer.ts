import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeTallyKey } from "@/lib/tally/group-mapping";
import type { TallyParsedExport } from "@/lib/tally/types";

type Db = PrismaClient;
type LogFn = (level: "INFO" | "WARN" | "ERROR", message: string, detail?: unknown) => void;

export type InventoryImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export async function importTallyInventory(
  userId: string,
  jobId: string,
  parsed: TallyParsedExport,
  log: LogFn,
  db: Db = prisma,
): Promise<InventoryImportResult> {
  const result: InventoryImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  for (const item of parsed.stockItems) {
    if (!item.name) {
      result.skipped++;
      continue;
    }

    const existingMap = await db.tallyEntityMap.findUnique({
      where: { userId_entityType_tallyKey: { userId, entityType: "STOCK_ITEM", tallyKey: item.name } },
    });

    if (existingMap) {
      try {
        await db.item.update({
          where: { id: existingMap.erpId },
          data: {
            name: item.name,
            unit: item.unit ?? "NOS",
            hsnCode: item.hsnCode,
            gstRate: item.gstRate ?? 0,
            salesRate: item.openingValue > 0 && item.openingQty > 0 ? item.openingValue / item.openingQty : undefined,
            reorderLevel: item.openingQty,
          },
        });
        result.updated++;
      } catch (e) {
        result.errors.push(`${item.name}: update failed`);
        log("ERROR", `Stock item update failed: ${item.name}`, e);
      }
      continue;
    }

    try {
      const row = await db.item.create({
        data: {
          userId,
          name: item.name,
          unit: item.unit ?? "NOS",
          hsnCode: item.hsnCode,
          gstRate: item.gstRate ?? 0,
          salesRate: item.openingQty > 0 ? item.openingValue / item.openingQty : 0,
          purchaseRate: item.openingQty > 0 ? item.openingValue / item.openingQty : 0,
          reorderLevel: item.openingQty,
          sellable: true,
          purchasable: true,
        },
      });
      await db.tallyEntityMap.create({
        data: {
          userId,
          jobId,
          entityType: "STOCK_ITEM",
          tallyKey: normalizeTallyKey(item.name),
          tallyGuid: item.guid,
          erpModel: "Item",
          erpId: row.id,
          parentTallyKey: item.parent,
          metaJson: JSON.stringify({ openingQty: item.openingQty, openingValue: item.openingValue }),
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push(`${item.name}: ${e instanceof Error ? e.message : "import failed"}`);
      log("ERROR", `Stock item import failed: ${item.name}`, e);
    }
  }

  return result;
}
