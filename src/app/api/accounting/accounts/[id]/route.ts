import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { accountPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const account = await prisma.account.findFirst({
    where: { id, userId: session.sub },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      children: { select: { id: true, code: true, name: true } },
      _count: { select: { journalLines: true } },
    },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId,
      parent: account.parent,
      children: account.children,
      openingBalance: Number(account.openingBalance),
      description: account.description,
      isActive: account.isActive,
      isSystem: account.isSystem,
      transactionCount: account._count.journalLines,
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

  const parsed = accountPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.account.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const nextType = data.type ?? existing.type;

  if (data.code?.trim()) {
    const clash = await prisma.account.findFirst({
      where: { userId: session.sub, code: data.code.trim(), id: { not: id } },
    });
    if (clash) return NextResponse.json({ error: "Code already in use." }, { status: 409 });
  }

  let parentId = data.parentId !== undefined ? data.parentId : existing.parentId;
  if (parentId === id) {
    return NextResponse.json({ error: "Account cannot be its own parent." }, { status: 400 });
  }
  if (parentId) {
    const parent = await prisma.account.findFirst({
      where: { id: parentId, userId: session.sub },
    });
    if (!parent) return NextResponse.json({ error: "Parent not found." }, { status: 400 });
    if (parent.type !== nextType) {
      return NextResponse.json({ error: "Parent must match account type." }, { status: 400 });
    }
  }

  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.code !== undefined ? { code: data.code?.trim() ?? existing.code } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.parentId !== undefined ? { parentId } : {}),
      ...(data.openingBalance !== undefined ? { openingBalance: data.openingBalance } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return NextResponse.json({
    account: { id: updated.id, code: updated.code, name: updated.name },
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.account.findFirst({
    where: { id, userId: session.sub },
    include: {
      _count: { select: { journalLines: true, children: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.isSystem) {
    return NextResponse.json({ error: "System accounts cannot be deleted." }, { status: 403 });
  }
  if (existing._count.journalLines > 0) {
    return NextResponse.json({ error: "Cannot delete an account that has transactions." }, { status: 409 });
  }
  if (existing._count.children > 0) {
    return NextResponse.json({ error: "Cannot delete an account that has child accounts." }, { status: 409 });
  }

  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
