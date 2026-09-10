import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { getAllocatedTotalForInvoice } from "@/lib/accounting/invoice-balance";
import { postPaymentReceipt } from "@/lib/accounting/posting";
import { syncInvoicePaymentStatus } from "@/lib/accounting/sync-invoice-status";
import { parseYmd } from "@/lib/dates";
import { getNextPaymentNumber } from "@/lib/payment-number";
import { prisma } from "@/lib/prisma";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";
import { getSession } from "@/lib/session";
import { paymentCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payments = await prisma.payment.findMany({
    where: { userId: session.sub },
    orderBy: { paymentDate: "desc" },
    take: 500,
    include: {
      customer: { select: { displayName: true } },
      allocations: { include: { invoice: { select: { invoiceNumber: true } } } },
    },
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate.toISOString(),
      customerName: p.customer.displayName,
      mode: p.mode,
      amount: Number(p.amount),
      reference: p.reference,
      allocations: p.allocations.map((a) => ({
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoice.invoiceNumber,
        amount: Number(a.amount),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paymentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const paymentDate = parseYmd(data.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, userId: session.sub },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const paymentNumber = data.paymentNumber?.trim() || (await getNextPaymentNumber(session.sub));

  const dup = await prisma.payment.findUnique({
    where: { userId_paymentNumber: { userId: session.sub, paymentNumber } },
  });
  if (dup) {
    return NextResponse.json({ error: "Payment number already in use" }, { status: 409 });
  }

  const allocSum = data.allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.abs(allocSum - data.amount) > 0.01) {
    return NextResponse.json({ error: "Allocations must sum to payment amount" }, { status: 400 });
  }

  const allocInvoiceIds = data.allocations.map((a) => a.invoiceId);
  if (new Set(allocInvoiceIds).size !== allocInvoiceIds.length) {
    return NextResponse.json({ error: "Duplicate invoice in the same payment is not allowed" }, { status: 400 });
  }

  const invoiceIds = [...new Set(allocInvoiceIds)];
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, userId: session.sub, customerId: data.customerId },
  });
  if (invoices.length !== invoiceIds.length) {
    return NextResponse.json({ error: "One or more invoices are invalid for this customer" }, { status: 400 });
  }

  for (const a of data.allocations) {
    const inv = invoices.find((i) => i.id === a.invoiceId)!;
    if (inv.status === "DRAFT" || inv.status === "VOID") {
      return NextResponse.json(
        { error: `Invoice ${inv.invoiceNumber} cannot receive payments in its current status` },
        { status: 400 },
      );
    }
    const already = await getAllocatedTotalForInvoice(prisma, a.invoiceId);
    const remaining = invoiceOpenAmount(inv) - already;
    if (a.amount > remaining + 0.01) {
      return NextResponse.json(
        { error: `Allocation exceeds open balance for invoice ${inv.invoiceNumber}` },
        { status: 400 },
      );
    }
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, session.sub);

      const pay = await tx.payment.create({
        data: {
          userId: session.sub,
          customerId: data.customerId,
          paymentNumber,
          paymentDate,
          mode: data.mode,
          reference: data.reference?.trim() ? data.reference.trim() : null,
          memo: data.memo?.trim() ? data.memo.trim() : null,
          amount: data.amount,
          allocations: {
            create: data.allocations.map((a) => ({
              invoiceId: a.invoiceId,
              amount: a.amount,
            })),
          },
        },
      });

      await postPaymentReceipt(tx, session.sub, pay.id);

      const affectedIds = [...new Set(data.allocations.map((a) => a.invoiceId))];
      for (const iid of affectedIds) {
        await syncInvoicePaymentStatus(tx, iid);
      }

      return pay;
    });

    return NextResponse.json({ id: payment.id, paymentNumber: payment.paymentNumber }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }
}
