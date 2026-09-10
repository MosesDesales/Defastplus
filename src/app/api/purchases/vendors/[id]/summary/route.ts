import { VendorBillStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, userId: session.sub },
  });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bills = await prisma.vendorBill.findMany({
    where: {
      userId: session.sub,
      vendorId: id,
      status: { notIn: [VendorBillStatus.VOID, VendorBillStatus.DRAFT] },
    },
    include: {
      paymentAllocations: true,
      creditApplications: true,
    },
    orderBy: { billDate: "desc" },
    take: 100,
  });

  const payments = await prisma.vendorPayment.findMany({
    where: { userId: session.sub, vendorId: id },
    orderBy: { paymentDate: "desc" },
    take: 50,
  });

  let totalPayables = Number(vendor.openingBalance);
  for (const b of bills) {
    const paid =
      b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
      b.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
    totalPayables += Number(b.total) - paid;
  }

  const overdue = bills.filter(
    (b) =>
      b.dueDate &&
      b.dueDate < new Date() &&
      b.status !== VendorBillStatus.PAID &&
      Number(b.total) >
        b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
          b.creditApplications.reduce((s, a) => s + Number(a.amount), 0),
  ).length;

  return NextResponse.json({
    vendorId: id,
    displayName: vendor.displayName,
    totalPayables,
    overdueBillCount: overdue,
    bills: bills.map((b) => {
      const paid =
        b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
        b.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: b.id,
        billNumber: b.billNumber,
        billDate: b.billDate.toISOString(),
        dueDate: b.dueDate?.toISOString() ?? null,
        total: Number(b.total),
        paid,
        balance: Number(b.total) - paid,
        status: b.status,
      };
    }),
    payments: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate.toISOString(),
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.reference,
    })),
  });
}
