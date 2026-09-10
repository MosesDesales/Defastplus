import { GstTaxPreference, ItemGstTaxMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWarehouse, suggestSku } from "@/lib/inventory";
import { getSession } from "@/lib/session";
import { itemCreateSchema } from "@/lib/validators";
import type { Item } from "@prisma/client";

function serializeItem(item: Item) {
  return {
    id: item.id,
    userId: item.userId,
    itemType: item.itemType,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    salesDescription: item.salesDescription,
    salesRate: Number(item.salesRate),
    purchaseDescription: item.purchaseDescription,
    purchaseRate: Number(item.purchaseRate),
    sellable: item.sellable,
    purchasable: item.purchasable,
    categoryId: item.categoryId,
    inventoryUnitId: item.inventoryUnitId,
    reorderLevel: Number(item.reorderLevel),
    isActive: item.isActive,
    description: item.description,
    gstTaxPreference: item.gstTaxPreference,
    gstApplicable: item.gstApplicable,
    gstRate: Number(item.gstRate),
    hsnCode: item.hsnCode,
    gstTaxMode: item.gstTaxMode,
    reverseCharge: item.reverseCharge,
    itcEligible: item.itcEligible,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.item.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items: items.map(serializeItem) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = itemCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  let sku = data.sku?.trim() ? data.sku.trim() : null;
  if (data.autoSku) {
    sku = await suggestSku(session.sub);
  }
  if (sku) {
    const clash = await prisma.item.findFirst({
      where: { userId: session.sub, sku },
    });
    if (clash) {
      return NextResponse.json({ error: "SKU already in use" }, { status: 409 });
    }
  }

  const salesDescription = data.salesDescription?.trim() ? data.salesDescription.trim() : null;
  const purchaseDescription = data.purchaseDescription?.trim() ? data.purchaseDescription.trim() : null;
  const description = data.description?.trim() ? data.description.trim() : null;

  let unitStr = data.unit.trim();
  let inventoryUnitId: string | null = data.inventoryUnitId ?? null;
  if (inventoryUnitId) {
    const u = await prisma.inventoryUnit.findFirst({
      where: { id: inventoryUnitId, userId: session.sub },
    });
    if (u) {
      unitStr = u.abbreviation?.trim() || u.name;
    } else {
      inventoryUnitId = null;
    }
  }

  let categoryId: string | null = data.categoryId ?? null;
  if (categoryId) {
    const c = await prisma.itemCategory.findFirst({
      where: { id: categoryId, userId: session.sub },
    });
    if (!c) categoryId = null;
  }

  const reorderLevel = data.reorderLevel ?? 0;
  const isActive = data.isActive ?? true;
  const openingStock = data.openingStock ?? 0;

  const gstAware =
    data.gstTaxPreference !== undefined ||
    data.gstApplicable !== undefined ||
    data.gstRate !== undefined ||
    (data.hsnCode !== undefined && data.hsnCode !== null && data.hsnCode.trim() !== "") ||
    data.gstTaxMode !== undefined ||
    data.reverseCharge !== undefined ||
    data.itcEligible !== undefined;
  const gstTaxPreference =
    data.gstTaxPreference ?? (gstAware ? GstTaxPreference.TAXABLE : GstTaxPreference.NON_TAXABLE);
  const gstApplicable = data.gstApplicable ?? gstTaxPreference === GstTaxPreference.TAXABLE;
  const gstRate =
    gstTaxPreference === GstTaxPreference.TAXABLE ? (data.gstRate ?? (gstAware ? 18 : 0)) : 0;
  const hsnCode =
    gstTaxPreference === GstTaxPreference.TAXABLE
      ? data.hsnCode?.trim()
        ? data.hsnCode.trim()
        : null
      : data.hsnCode?.trim()
        ? data.hsnCode.trim()
        : null;
  const gstTaxMode = data.gstTaxMode ?? ItemGstTaxMode.AUTO;
  const reverseCharge = data.reverseCharge ?? false;
  const itcEligible = data.itcEligible ?? true;

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        userId: session.sub,
        itemType: data.itemType,
        name: data.name.trim(),
        sku,
        unit: unitStr,
        salesDescription,
        purchaseDescription,
        description,
        salesRate: data.salesRate,
        purchaseRate: data.purchaseRate,
        sellable: data.sellable,
        purchasable: data.purchasable,
        categoryId,
        inventoryUnitId,
        reorderLevel,
        isActive,
        gstTaxPreference,
        gstApplicable,
        gstRate,
        hsnCode,
        gstTaxMode,
        reverseCharge,
        itcEligible,
      },
    });

    if (openingStock > 0 && data.itemType === "GOODS") {
      let warehouseId: string | null = null;
      if (data.warehouseId) {
        const w = await tx.warehouse.findFirst({
          where: { id: data.warehouseId, userId: session.sub },
        });
        warehouseId = w?.id ?? null;
      }
      if (!warehouseId) {
        const wh = await ensureDefaultWarehouse(tx, session.sub);
        warehouseId = wh.id;
      }
      await tx.itemStock.create({
        data: {
          itemId: created.id,
          warehouseId,
          quantity: openingStock,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ item: serializeItem(item) }, { status: 201 });
}
