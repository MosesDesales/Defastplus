import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { itemCategorySchema } from "@/lib/validators";

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

  const parsed = itemCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.itemCategory.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const cat = await prisma.itemCategory.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ category: { id: cat.id, name: cat.name } });
  } catch {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.itemCategory.findFirst({
    where: { id, userId: session.sub },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.item.updateMany({
    where: { categoryId: id, userId: session.sub },
    data: { categoryId: null },
  });

  await prisma.itemCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
