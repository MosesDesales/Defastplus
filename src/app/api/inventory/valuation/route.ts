import { ItemType } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureInventorySettings, totalStockQty } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** MVP: both FIFO and weighted average use purchase rate as unit cost (single cost layer). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const methodParam = new URL(request.url).searchParams.get("method");
  const settings = await ensureInventorySettings(prisma, session.sub);

  const method =
    methodParam === "FIFO" || methodParam === "WEIGHTED_AVERAGE"
      ? methodParam
      : settings.valuationMethod;

  const items = await prisma.item.findMany({
    where: { userId: session.sub, itemType: ItemType.GOODS },
    include: { stocks: true, category: true },
    orderBy: { name: "asc" },
  });

  let totalValue = 0;
  const rows = items
    .map((item) => {
      const qty = totalStockQty(item.stocks);
      const unitCost = Number(item.purchaseRate);
      const lineValue = qty * unitCost;

      return {
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        categoryName: item.category?.name ?? null,
        quantityOnHand: qty,
        unitCost,
        lineValue,
        methodHint:
          method === "FIFO"
            ? "FIFO — valued at purchase rate (single layer)."
            : "Weighted average — valued at current purchase rate.",
      };
    })
    .filter((r) => r.quantityOnHand > 0);

  totalValue = rows.reduce((s, r) => s + r.lineValue, 0);

  return NextResponse.json({
    valuationMethod: method,
    totalValue,
    rows,
  });
}
