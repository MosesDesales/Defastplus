import { GstTaxPreference, ItemGstTaxMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { inventoryItemUpdateSchema, validateMergedItemGstRules } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const item = await prisma.item.findFirst({
    where: { id, userId: session.sub },
    include: {
      category: true,
      inventoryUnit: true,
      stocks: { include: { warehouse: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stockTotal = item.stocks.reduce((s, r) => s + Number(r.quantity), 0);

  return NextResponse.json({
    item: {
      id: item.id,
      itemType: item.itemType,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      categoryId: item.categoryId,
      inventoryUnitId: item.inventoryUnitId,
      salesDescription: item.salesDescription,
      purchaseDescription: item.purchaseDescription,
      description: item.description,
      salesRate: Number(item.salesRate),
      purchaseRate: Number(item.purchaseRate),
      sellable: item.sellable,
      purchasable: item.purchasable,
      reorderLevel: Number(item.reorderLevel),
      isActive: item.isActive,
      gstTaxPreference: item.gstTaxPreference,
      gstApplicable: item.gstApplicable,
      gstRate: Number(item.gstRate),
      hsnCode: item.hsnCode,
      gstTaxMode: item.gstTaxMode,
      reverseCharge: item.reverseCharge,
      itcEligible: item.itcEligible,
      stockQuantity: stockTotal,
      stocks: item.stocks.map((x) => ({
        warehouseId: x.warehouseId,
        warehouseName: x.warehouse.name,
        quantity: Number(x.quantity),
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.item.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inventoryItemUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  let unitStr = data.unit ?? existing.unit;
  let inventoryUnitId = data.inventoryUnitId !== undefined ? data.inventoryUnitId : existing.inventoryUnitId;
  if (data.inventoryUnitId !== undefined && data.inventoryUnitId !== null) {
    const u = await prisma.inventoryUnit.findFirst({
      where: { id: data.inventoryUnitId, userId: session.sub },
    });
    if (u) {
      unitStr = u.abbreviation?.trim() || u.name;
      inventoryUnitId = u.id;
    }
  }

  let categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
  if (data.categoryId !== undefined && data.categoryId !== null) {
    const c = await prisma.itemCategory.findFirst({
      where: { id: data.categoryId, userId: session.sub },
    });
    categoryId = c?.id ?? null;
  } else if (data.categoryId === null) {
    categoryId = null;
  }

  const mergedPref =
    data.gstTaxPreference !== undefined ? data.gstTaxPreference : existing.gstTaxPreference;
  const mergedApplicable =
    data.gstApplicable !== undefined ? data.gstApplicable : existing.gstApplicable;
  const mergedRate = data.gstRate !== undefined ? data.gstRate : Number(existing.gstRate);
  const mergedHsn =
    data.hsnCode !== undefined ? (data.hsnCode?.trim() ? data.hsnCode.trim() : null) : existing.hsnCode;
  const mergedMode = data.gstTaxMode !== undefined ? data.gstTaxMode : existing.gstTaxMode;
  const mergedRev = data.reverseCharge !== undefined ? data.reverseCharge : existing.reverseCharge;
  const mergedItc = data.itcEligible !== undefined ? data.itcEligible : existing.itcEligible;

  const gstErr = validateMergedItemGstRules({
    gstTaxPreference: mergedPref,
    gstRate: mergedPref === GstTaxPreference.TAXABLE ? mergedRate : 0,
    hsnCode: mergedHsn,
  });
  if (gstErr) {
    return NextResponse.json({ error: gstErr }, { status: 400 });
  }

  const storedGstRate = mergedPref === GstTaxPreference.TAXABLE ? mergedRate : 0;

  const touchesGst =
    data.gstTaxPreference !== undefined ||
    data.gstApplicable !== undefined ||
    data.gstRate !== undefined ||
    data.hsnCode !== undefined ||
    data.gstTaxMode !== undefined ||
    data.reverseCharge !== undefined ||
    data.itcEligible !== undefined;

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(data.itemType !== undefined ? { itemType: data.itemType } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.sku !== undefined ? { sku: data.sku?.trim() ? data.sku.trim() : null } : {}),
      unit: unitStr,
      ...(data.inventoryUnitId !== undefined ? { inventoryUnitId } : {}),
      ...(data.salesDescription !== undefined ? { salesDescription: data.salesDescription } : {}),
      ...(data.purchaseDescription !== undefined ? { purchaseDescription: data.purchaseDescription } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.salesRate !== undefined ? { salesRate: data.salesRate } : {}),
      ...(data.purchaseRate !== undefined ? { purchaseRate: data.purchaseRate } : {}),
      ...(data.sellable !== undefined ? { sellable: data.sellable } : {}),
      ...(data.purchasable !== undefined ? { purchasable: data.purchasable } : {}),
      ...(data.categoryId !== undefined ? { categoryId } : {}),
      ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(touchesGst
        ? {
            gstTaxPreference: mergedPref as GstTaxPreference,
            gstApplicable: mergedApplicable,
            gstTaxMode: mergedMode as ItemGstTaxMode,
            reverseCharge: mergedRev,
            itcEligible: mergedItc,
            gstRate: storedGstRate,
            hsnCode: mergedHsn,
          }
        : {}),
    },
  });

  return NextResponse.json({ item: { id: updated.id } });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.item.findFirst({
    where: { id, userId: session.sub },
    include: { invoiceLines: { take: 1 }, quoteLines: { take: 1 } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.invoiceLines.length > 0 || existing.quoteLines.length > 0) {
    return NextResponse.json(
      { error: "Item is referenced on documents; deactivate instead of deleting." },
      { status: 409 },
    );
  }

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
