import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const e = await prisma.purchaseExpense.findFirst({
    where: { id, userId: session.sub },
    include: {
      expenseAccount: { select: { id: true, code: true, name: true } },
      bankAccount: { select: { id: true, code: true, name: true } },
    },
  });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    expense: {
      id: e.id,
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
      expenseAccountId: e.expenseAccountId,
      bankAccountId: e.bankAccountId,
      amount: Number(e.amount),
      taxAmount: Number(e.taxAmount),
      notes: e.notes,
      attachmentUrl: e.attachmentUrl,
      posted: Boolean(e.journalEntryId),
      expenseAccount: e.expenseAccount,
      bankAccount: e.bankAccount,
    },
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const e = await prisma.purchaseExpense.findFirst({
    where: { id, userId: session.sub },
  });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (e.journalEntryId) {
      await tx.journalEntry.delete({ where: { id: e.journalEntryId } });
    }
    await tx.purchaseExpense.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
