import { CreditNoteStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { syncInvoicePaymentStatus } from "@/lib/accounting/sync-invoice-status";
import { prisma } from "@/lib/prisma";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";
import { getSession } from "@/lib/session";
import { creditNoteApplySchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "credit_note");
  if (denied) return denied;
  const { id: creditNoteId } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = creditNoteApplySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { invoiceId, amount } = parsed.data;

  const credit = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, userId: session.sub },
  });
  if (!credit) return NextResponse.json({ error: "Credit note not found" }, { status: 404 });

  if (credit.status === CreditNoteStatus.DRAFT) {
    return NextResponse.json({ error: "Issue the credit note before applying it." }, { status: 400 });
  }
  if (credit.status === CreditNoteStatus.CLOSED) {
    return NextResponse.json({ error: "Credit note is closed." }, { status: 400 });
  }
  if (credit.status === CreditNoteStatus.APPLIED) {
    return NextResponse.json({ error: "No remaining credit on this note." }, { status: 400 });
  }
  if (!credit.reversalJournalId) {
    return NextResponse.json({ error: "Credit note is not posted to the ledger." }, { status: 400 });
  }

  const remaining = Number(credit.total) - Number(credit.amountApplied);
  if (amount > remaining + 0.02) {
    return NextResponse.json({ error: "Amount exceeds available credit." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: session.sub },
    include: { allocations: true, creditNoteApplications: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.customerId !== credit.customerId) {
    return NextResponse.json({ error: "Invoice must belong to the same customer as the credit note." }, { status: 400 });
  }

  const paid = invoice.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const creditsOnInvoice = invoice.creditNoteApplications.reduce((s, a) => s + Number(a.amount), 0);
  const due = invoiceOpenAmount(invoice) - paid - creditsOnInvoice;
  if (amount > due + 0.02) {
    return NextResponse.json({ error: "Amount exceeds invoice balance (after payments and other credits)." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditNoteApplication.create({
      data: {
        creditNoteId: credit.id,
        invoiceId,
        amount: new Prisma.Decimal(amount),
      },
    });

    const newApplied = Number(credit.amountApplied) + amount;
    const nextCnStatus =
      newApplied + 0.005 >= Number(credit.total) ? CreditNoteStatus.APPLIED : CreditNoteStatus.OPEN;

    await tx.creditNote.update({
      where: { id: credit.id },
      data: {
        amountApplied: new Prisma.Decimal(newApplied),
        status: nextCnStatus,
      },
    });

    await syncInvoicePaymentStatus(tx, invoiceId);
  });

  return NextResponse.json({ ok: true });
}
