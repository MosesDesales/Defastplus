import { ItemType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { totalStockQty } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

function serializeRow(
  item: Prisma.ItemGetPayload<{
    include: {
      category: true;
      inventoryUnit: true;
      stocks: true;
    };
  }>,
) {
  const qty = totalStockQty(item.stocks);
  const reorder = Number(item.reorderLevel);
  const lowStock = item.itemType === ItemType.GOODS && qty <= reorder && reorder > 0;
  const outOfStock = qty <= 0;

  return {
    id: item.id,
    itemType: item.itemType,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    inventoryUnitId: item.inventoryUnitId,
    unitDisplay:
      item.inventoryUnit != null
        ? `${item.inventoryUnit.name}${item.inventoryUnit.abbreviation ? ` (${item.inventoryUnit.abbreviation})` : ""}`
        : item.unit,
    purchaseRate: Number(item.purchaseRate),
    salesRate: Number(item.salesRate),
    stockQuantity: qty,
    reorderLevel: reorder,
    isActive: item.isActive,
    lowStock,
    outOfStock,
    description: item.description,
    gstTaxPreference: item.gstTaxPreference,
    gstApplicable: item.gstApplicable,
    gstRate: Number(item.gstRate),
    hsnCode: item.hsnCode,
    gstTaxMode: item.gstTaxMode,
    reverseCharge: item.reverseCharge,
    itcEligible: item.itcEligible,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiModules(session.sub, "inventory");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const stockFilter = searchParams.get("stock") ?? "all"; // all | in_stock | out_of_stock | low_stock

  const items = await prisma.item.findMany({
    where: {
      userId: session.sub,
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      category: true,
      inventoryUnit: true,
      stocks: true,
    },
    orderBy: { name: "asc" },
  });

  let rows = items.map(serializeRow);

  if (search) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        (r.sku?.toLowerCase().includes(search) ?? false),
    );
  }

  if (stockFilter === "in_stock") {
    rows = rows.filter((r) => r.stockQuantity > 0);
  } else if (stockFilter === "out_of_stock") {
    rows = rows.filter((r) => r.outOfStock);
  } else if (stockFilter === "low_stock") {
    rows = rows.filter((r) => r.lowStock || (r.stockQuantity <= r.reorderLevel && r.reorderLevel > 0));
  }

  return NextResponse.json({ items: rows });
}
