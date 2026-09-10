import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { inventoryUnitSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

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

  const parsed = inventoryUnitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.inventoryUnit.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const u = await prisma.inventoryUnit.update({
      where: { id },
      data: {
        name: parsed.data.name,
        abbreviation: parsed.data.abbreviation?.trim() ?? "",
      },
    });
    return NextResponse.json({
      unit: { id: u.id, name: u.name, abbreviation: u.abbreviation },
    });
  } catch {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.inventoryUnit.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.item.updateMany({
    where: { inventoryUnitId: id, userId: session.sub },
    data: { inventoryUnitId: null },
  });

  await prisma.inventoryUnit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
