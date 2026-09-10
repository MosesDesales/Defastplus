import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { warehouseSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const w = await prisma.warehouse.findFirst({
    where: { id, userId: session.sub },
    include: {
      stocks: {
        include: {
          item: { select: { id: true, name: true, sku: true, purchaseRate: true } },
        },
      },
    },
  });

  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    warehouse: {
      id: w.id,
      name: w.name,
      code: w.code,
      isDefault: w.isDefault,
      lines: w.stocks.map((s) => ({
        itemId: s.itemId,
        itemName: s.item.name,
        sku: s.item.sku,
        quantity: Number(s.quantity),
        purchaseRate: Number(s.item.purchaseRate),
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = warehouseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.warehouse.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { userId: session.sub },
      data: { isDefault: false },
    });
  }

  const w = await prisma.warehouse.update({
    where: { id },
    data: {
      name: parsed.data.name,
      code: parsed.data.code?.trim() || null,
      ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
    },
  });

  if (w.isDefault) {
    await prisma.warehouse.updateMany({
      where: { userId: session.sub, id: { not: w.id } },
      data: { isDefault: false },
    });
  }

  return NextResponse.json({
    warehouse: { id: w.id, name: w.name, code: w.code, isDefault: w.isDefault },
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.warehouse.findFirst({
    where: { id, userId: session.sub },
    include: { stocks: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.isDefault) {
    return NextResponse.json({ error: "Cannot delete the default warehouse. Set another as default first." }, { status: 409 });
  }
  const qtySum = row.stocks.reduce((s, x) => s + Number(x.quantity), 0);
  if (qtySum > 0) {
    return NextResponse.json({ error: "Warehouse has stock. Transfer or adjust stock first." }, { status: 409 });
  }

  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
