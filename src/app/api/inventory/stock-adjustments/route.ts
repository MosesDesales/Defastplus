import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { stockAdjustmentSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.stockAdjustment.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      item: { select: { name: true, sku: true } },
      warehouse: { select: { name: true } },
    },
  });

  return NextResponse.json({
    adjustments: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      itemId: r.itemId,
      itemName: r.item.name,
      sku: r.item.sku,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      quantityDelta: Number(r.quantityDelta),
      reason: r.reason,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = stockAdjustmentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.item.findFirst({
    where: { id: parsed.data.itemId, userId: session.sub },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: parsed.data.warehouseId, userId: session.sub },
  });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  const delta = parsed.data.quantityDelta;

  const existingStock = await prisma.itemStock.findUnique({
    where: {
      itemId_warehouseId: {
        itemId: item.id,
        warehouseId: warehouse.id,
      },
    },
  });
  const current = existingStock ? Number(existingStock.quantity) : 0;
  const next = current + delta;
  if (next < 0) {
    return NextResponse.json({ error: "Adjustment would make stock negative." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockAdjustment.create({
      data: {
        userId: session.sub,
        itemId: item.id,
        warehouseId: warehouse.id,
        quantityDelta: delta,
        reason: parsed.data.reason.trim(),
      },
    });

    await tx.itemStock.upsert({
      where: {
        itemId_warehouseId: {
          itemId: item.id,
          warehouseId: warehouse.id,
        },
      },
      create: {
        itemId: item.id,
        warehouseId: warehouse.id,
        quantity: next,
      },
      update: {
        quantity: next,
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
