import { Prisma, VendorCreditStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { recalculateVendorBillStatus } from "@/lib/accounting/purchases-posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { vendorCreditApplySchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: creditId } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorCreditApplySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { billId, amount } = parsed.data;

  const credit = await prisma.vendorCredit.findFirst({
    where: { id: creditId, userId: session.sub },
  });
  if (!credit) return NextResponse.json({ error: "Credit not found" }, { status: 404 });

  const bill = await prisma.vendorBill.findFirst({
    where: { id: billId, userId: session.sub, vendorId: credit.vendorId },
    include: {
      paymentAllocations: true,
      creditApplications: true,
    },
  });
  if (!bill) return NextResponse.json({ error: "Bill not found for this vendor" }, { status: 404 });

  const remaining = Number(credit.amount) - Number(credit.amountApplied);
  if (amount > remaining + 0.02) {
    return NextResponse.json({ error: "Amount exceeds available credit." }, { status: 400 });
  }

  const paidSoFar =
    bill.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
    bill.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
  const due = Number(bill.total) - paidSoFar;
  if (amount > due + 0.02) {
    return NextResponse.json({ error: "Amount exceeds bill balance." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorCreditApplication.create({
      data: {
        creditId: credit.id,
        billId,
        amount: new Prisma.Decimal(amount),
      },
    });

    const newApplied = Number(credit.amountApplied) + amount;
    await tx.vendorCredit.update({
      where: { id: credit.id },
      data: {
        amountApplied: new Prisma.Decimal(newApplied),
        status: newApplied + 0.005 >= Number(credit.amount) ? VendorCreditStatus.CLOSED : VendorCreditStatus.OPEN,
      },
    });

    await recalculateVendorBillStatus(tx, billId);
  });

  return NextResponse.json({ ok: true });
}
