import { InvoiceStatus, VendorBillStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAllocatedTotalForInvoice } from "@/lib/accounting/invoice-balance";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";

async function billOpen(billId: string): Promise<number> {
  const bill = await prisma.vendorBill.findUnique({
    where: { id: billId },
    include: { paymentAllocations: true, creditApplications: true },
  });
  if (!bill) return 0;
  const paid =
    bill.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
    bill.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
  return Number(bill.total) - paid;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: session.sub,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
    },
    take: 100,
    orderBy: { issueDate: "desc" },
    include: { customer: { select: { displayName: true } } },
  });

  const invoiceRows = [];
  for (const inv of invoices) {
    const already = await getAllocatedTotalForInvoice(prisma, inv.id);
    const open = invoiceOpenAmount(inv) - already;
    if (open < 0.01) continue;
    invoiceRows.push({
      id: inv.id,
      label: `${inv.invoiceNumber} · ${inv.customer.displayName}`,
      open,
      total: Number(inv.payableTotal),
      status: inv.status,
    });
  }

  const billsRaw = await prisma.vendorBill.findMany({
    where: {
      userId: session.sub,
      status: { in: [VendorBillStatus.UNPAID, VendorBillStatus.PARTIALLY_PAID] },
    },
    take: 100,
    orderBy: { billDate: "desc" },
    include: { vendor: { select: { displayName: true } } },
  });

  const billRows = [];
  for (const b of billsRaw) {
    const open = await billOpen(b.id);
    if (open < 0.01) continue;
    billRows.push({
      id: b.id,
      label: `${b.billNumber} · ${b.vendor.displayName}`,
      open,
      total: Number(b.total),
      status: b.status,
    });
  }

  const expenseAccounts = await prisma.account.findMany({
    where: { userId: session.sub, isActive: true, type: "EXPENSE" },
    orderBy: { code: "asc" },
    take: 200,
    select: { id: true, code: true, name: true },
  });

  return NextResponse.json({ invoices: invoiceRows, bills: billRows, expenseAccounts });
}
