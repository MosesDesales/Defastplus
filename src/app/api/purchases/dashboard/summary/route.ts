import { VendorBillStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendors = await prisma.vendor.findMany({
    where: { userId: session.sub },
    select: { openingBalance: true },
  });
  let totalPayables = vendors.reduce((s, v) => s + Number(v.openingBalance), 0);

  const bills = await prisma.vendorBill.findMany({
    where: {
      userId: session.sub,
      status: { notIn: [VendorBillStatus.VOID, VendorBillStatus.DRAFT] },
    },
    include: {
      paymentAllocations: true,
      creditApplications: true,
    },
  });

  const now = new Date();
  let overdueCount = 0;

  for (const b of bills) {
    const paid =
      b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
      b.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
    const bal = Number(b.total) - paid;
    totalPayables += bal;
    if (
      bal > 0.005 &&
      b.dueDate &&
      b.dueDate < now &&
      b.status !== VendorBillStatus.PAID
    ) {
      overdueCount += 1;
    }
  }

  const recentBills = await prisma.vendorBill.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      vendor: { select: { displayName: true, email: true } },
      paymentAllocations: true,
      creditApplications: true,
    },
  });

  const expenseMonth = await prisma.purchaseExpense.aggregate({
    where: {
      userId: session.sub,
      expenseDate: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    },
    _sum: { amount: true, taxAmount: true },
  });

  return NextResponse.json({
    totalPayables,
    overdueBillCount: overdueCount,
    openBillCount: bills.filter((b) => b.status !== VendorBillStatus.PAID).length,
    recentBills: recentBills.map((b) => {
      const paid =
        b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
        b.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: b.id,
        billNumber: b.billNumber,
        vendorName: b.vendor.displayName,
        vendorEmail: b.vendor.email,
        total: Number(b.total),
        balance: Number(b.total) - paid,
        status: b.status,
        billDate: b.billDate.toISOString(),
      };
    }),
    expenseMonthTotal:
      Number(expenseMonth._sum.amount ?? 0) + Number(expenseMonth._sum.taxAmount ?? 0),
  });
}
