import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postVendorPaymentJournal, recalculateVendorBillStatus } from "@/lib/accounting/purchases-posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { vendorPaymentCreateSchema } from "@/lib/validators";

async function nextPaymentNumber(userId: string) {
  const n = await prisma.vendorPayment.count({ where: { userId } });
  return `VPAY-${String(n + 1).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendorId = new URL(request.url).searchParams.get("vendorId") ?? undefined;

  const rows = await prisma.vendorPayment.findMany({
    where: { userId: session.sub, ...(vendorId ? { vendorId } : {}) },
    orderBy: { paymentDate: "desc" },
    take: 200,
    include: {
      vendor: { select: { displayName: true } },
      allocations: { include: { bill: { select: { billNumber: true } } } },
    },
  });

  return NextResponse.json({
    payments: rows.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate.toISOString(),
      vendorId: p.vendorId,
      vendorName: p.vendor.displayName,
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.reference,
      posted: Boolean(p.journalEntryId),
      allocations: p.allocations.map((a) => ({
        billId: a.billId,
        billNumber: a.bill.billNumber,
        amount: Number(a.amount),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorPaymentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const paymentDate = parseYmd(data.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: data.vendorId, userId: session.sub },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const bankOk = await prisma.account.findFirst({
    where: { id: data.bankAccountId, userId: session.sub, isActive: true },
  });
  if (!bankOk) return NextResponse.json({ error: "Invalid bank account" }, { status: 400 });

  let allocSum = 0;
  for (const a of data.allocations) {
    const bill = await prisma.vendorBill.findFirst({
      where: { id: a.billId, userId: session.sub, vendorId: data.vendorId },
    });
    if (!bill) {
      return NextResponse.json({ error: `Invalid bill ${a.billId}` }, { status: 400 });
    }
    allocSum += a.amount;
  }

  if (Math.abs(allocSum - data.amount) > 0.02) {
    return NextResponse.json({ error: "Allocations must sum to payment amount." }, { status: 400 });
  }

  const paymentNumber = data.paymentNumber?.trim() || (await nextPaymentNumber(session.sub));
  const clash = await prisma.vendorPayment.findUnique({
    where: { userId_paymentNumber: { userId: session.sub, paymentNumber } },
  });
  if (clash) return NextResponse.json({ error: "Payment number in use" }, { status: 409 });

  const payment = await prisma.$transaction(async (tx) => {
    await ensureDefaultAccounts(tx, session.sub);

    const pay = await tx.vendorPayment.create({
      data: {
        userId: session.sub,
        vendorId: data.vendorId,
        paymentNumber,
        paymentDate,
        mode: data.mode,
        reference: data.reference?.trim() ?? null,
        amount: new Prisma.Decimal(data.amount),
        memo: data.memo?.trim() ?? null,
        bankAccountId: data.bankAccountId,
        allocations: {
          create: data.allocations.map((a) => ({
            billId: a.billId,
            amount: new Prisma.Decimal(a.amount),
          })),
        },
      },
    });

    await postVendorPaymentJournal(tx, session.sub, pay.id);

    for (const a of data.allocations) {
      await recalculateVendorBillStatus(tx, a.billId);
    }

    return pay;
  });

  return NextResponse.json({ payment: { id: payment.id, paymentNumber } }, { status: 201 });
}
