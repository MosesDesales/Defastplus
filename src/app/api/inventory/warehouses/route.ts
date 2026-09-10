import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWarehouse } from "@/lib/inventory";
import { getSession } from "@/lib/session";
import { warehouseSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "inventory", "warehouses");
  if (denied) return denied;

  await ensureDefaultWarehouse(prisma, session.sub);

  const warehouses = await prisma.warehouse.findMany({
    where: { userId: session.sub },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      stocks: true,
    },
  });

  return NextResponse.json({
    warehouses: warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      isDefault: w.isDefault,
      stockLines: w.stocks.length,
      totalUnits: w.stocks.reduce((s, r) => s + Number(r.quantity), 0),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "inventory", "warehouses");
  if (denied) return denied;

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

  if (parsed.data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { userId: session.sub },
      data: { isDefault: false },
    });
  }

  const w = await prisma.warehouse.create({
    data: {
      userId: session.sub,
      name: parsed.data.name,
      code: parsed.data.code?.trim() || null,
      isDefault: parsed.data.isDefault ?? false,
    },
  });

  if (w.isDefault) {
    await prisma.warehouse.updateMany({
      where: { userId: session.sub, id: { not: w.id } },
      data: { isDefault: false },
    });
  }

  return NextResponse.json(
    { warehouse: { id: w.id, name: w.name, code: w.code, isDefault: w.isDefault } },
    { status: 201 },
  );
}
