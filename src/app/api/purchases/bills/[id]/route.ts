import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const bill = await prisma.vendorBill.findFirst({
    where: { id, userId: session.sub },
    include: {
      vendor: { select: { id: true, displayName: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      purchaseOrder: { select: { id: true, poNumber: true } },
      paymentAllocations: {
        include: { payment: { select: { paymentNumber: true, paymentDate: true } } },
      },
      creditApplications: {
        include: { credit: { select: { creditNumber: true } } },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const paid =
    bill.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
    bill.creditApplications.reduce((s, a) => s + Number(a.amount), 0);

  return NextResponse.json({
    bill: {
      id: bill.id,
      billNumber: bill.billNumber,
      reference: bill.reference,
      billDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate?.toISOString() ?? null,
      status: bill.status,
      vendor: bill.vendor,
      purchaseOrder: bill.purchaseOrder,
      subTotal: Number(bill.subTotal),
      taxTotal: Number(bill.taxTotal),
      total: Number(bill.total),
      paid,
      balance: Number(bill.total) - paid,
      posted: Boolean(bill.journalEntryId),
      lines: bill.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        taxPercent: Number(l.taxPercent),
        lineNet: Number(l.lineNet),
        lineTax: Number(l.lineTax),
        lineTotal: Number(l.lineTotal),
        expenseAccountId: l.expenseAccountId,
        itemId: l.itemId,
      })),
      payments: bill.paymentAllocations.map((a) => ({
        paymentId: a.paymentId,
        paymentNumber: a.payment.paymentNumber,
        paymentDate: a.payment.paymentDate.toISOString(),
        amount: Number(a.amount),
      })),
      creditApplications: bill.creditApplications.map((a) => ({
        creditId: a.creditId,
        creditNumber: a.credit.creditNumber,
        amount: Number(a.amount),
      })),
    },
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const bill = await prisma.vendorBill.findFirst({
    where: { id, userId: session.sub },
    include: {
      _count: { select: { paymentAllocations: true, creditApplications: true } },
    },
  });
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (bill._count.paymentAllocations + bill._count.creditApplications > 0) {
    return NextResponse.json({ error: "Bill has payments or credits applied." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (bill.journalEntryId) {
      await tx.journalEntry.delete({ where: { id: bill.journalEntryId } });
    }
    await tx.vendorBill.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
