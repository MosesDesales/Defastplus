import { CreditNoteStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { postCreditNoteJournal } from "@/lib/accounting/posting";
import { buildInvoiceLineRows } from "@/lib/sales/invoice-line-build";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { creditNoteCreateSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

async function nextCreditNoteNumber(userId: string) {
  const n = await prisma.creditNote.count({ where: { userId } });
  return `CN-${String(n + 1).padStart(5, "0")}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "credit_note");
  if (denied) return denied;

  const rows = await prisma.creditNote.findMany({
    where: { userId: session.sub },
    orderBy: { issueDate: "desc" },
    take: 300,
    include: { customer: { select: { displayName: true, email: true } } },
  });

  return NextResponse.json({
    creditNotes: rows.map((c) => ({
      id: c.id,
      creditNumber: c.creditNumber,
      issueDate: c.issueDate.toISOString(),
      customerId: c.customerId,
      customerName: c.customer.displayName,
      customerEmail: c.customer.email,
      status: c.status,
      total: Number(c.total),
      amountApplied: Number(c.amountApplied),
      balance: Number(c.total) - Number(c.amountApplied),
      reason: c.reason,
      posted: Boolean(c.reversalJournalId),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "credit_note");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = creditNoteCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const issueDate = parseYmd(d.issueDate);
  if (Number.isNaN(issueDate.getTime())) return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, userId: session.sub },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  if (d.invoiceId) {
    const inv = await prisma.invoice.findFirst({
      where: { id: d.invoiceId, userId: session.sub },
    });
    if (!inv) return NextResponse.json({ error: "Reference invoice not found" }, { status: 404 });
    if (inv.customerId !== d.customerId) {
      return NextResponse.json({ error: "Reference invoice must belong to the same customer." }, { status: 400 });
    }
  }

  const companyProfile = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  const companyGstin = companyProfile?.gstin ?? null;

  const lineInputs = d.lines.map((l) => ({
    itemId: l.itemId,
    description: l.description,
    quantity: l.quantity,
    rate: l.rate,
    taxPercent: l.taxPercent,
  }));

  const built = await buildInvoiceLineRows(prisma, session.sub, customer, companyGstin, lineInputs);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const creditNumber = d.creditNumber?.trim() || (await nextCreditNoteNumber(session.sub));
  const clash = await prisma.creditNote.findUnique({
    where: { userId_creditNumber: { userId: session.sub, creditNumber } },
  });
  if (clash) return NextResponse.json({ error: "Credit number already in use" }, { status: 409 });

  const issueNow = d.issueNow ?? false;
  const initialStatus = issueNow ? CreditNoteStatus.OPEN : CreditNoteStatus.DRAFT;

  const lineCreates = built.lineRows.map((r) => ({
    itemId: r.itemId,
    description: r.description,
    quantity: r.quantity,
    rate: r.rate,
    taxPercent: r.taxPercent,
    lineNet: r.lineNet,
    lineTax: r.lineTax,
    lineTotal: r.lineTotal,
    lineCgst: r.lineCgst,
    lineSgst: r.lineSgst,
    lineIgst: r.lineIgst,
    sortOrder: r.sortOrder,
  }));

  try {
    const cn = await prisma.$transaction(async (tx) => {
      const note = await tx.creditNote.create({
        data: {
          userId: session.sub,
          customerId: d.customerId,
          creditNumber,
          issueDate,
          status: initialStatus,
          invoiceId: d.invoiceId ?? null,
          reason: d.reason?.trim() ?? null,
          subTotal: new Prisma.Decimal(built.subTotal),
          taxTotal: new Prisma.Decimal(built.taxTotal),
          total: new Prisma.Decimal(built.total),
          lines: { create: lineCreates },
        },
      });

      if (issueNow) {
        await postCreditNoteJournal(tx, session.sub, note.id);
      }

      return note;
    });

    return NextResponse.json(
      { creditNote: { id: cn.id, creditNumber: cn.creditNumber, status: cn.status } },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create credit note" }, { status: 500 });
  }
}
