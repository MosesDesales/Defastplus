import { InvoiceStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postInvoiceIssuance } from "@/lib/accounting/posting";
import { parseYmd } from "@/lib/dates";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { computeInvoiceSummaryView, invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";
import { buildInvoiceLineRows } from "@/lib/sales/invoice-line-build";
import { resolveDocumentCurrencyForSave } from "@/lib/currencies/document-currency";
import { resolveInvoiceTemplateId } from "@/lib/document-templates-service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invoiceCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") ?? undefined;
  const rawStatus = searchParams.get("status");
  const statuses = rawStatus
    ? (rawStatus.split(",").map((s) => s.trim()).filter(Boolean) as InvoiceStatus[])
    : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: session.sub,
      ...(customerId ? { customerId } : {}),
      ...(statuses?.length ? { status: { in: statuses } } : {}),
    },
    orderBy: { issueDate: "desc" },
    take: 500,
    include: {
      customer: { select: { displayName: true } },
      allocations: true,
      creditNoteApplications: true,
    },
  });

  return NextResponse.json({
    invoices: invoices.map((inv) => {
      const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
      const creditsApplied = inv.creditNoteApplications.reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        customerId: inv.customerId,
        customerName: inv.customer.displayName,
        status: inv.status,
        subTotal: Number(inv.subTotal),
        taxTotal: Number(inv.taxTotal),
        total: Number(inv.total),
        payableTotal: invoiceOpenAmount(inv),
        paid,
        creditsApplied,
        balance: invoiceOpenAmount(inv) - paid - creditsApplied,
        currency: inv.currency,
        exchangeRate: inv.exchangeRate != null ? Number(inv.exchangeRate) : null,
        baseTotal: inv.baseTotal != null ? Number(inv.baseTotal) : null,
        updatedAt: inv.updatedAt.toISOString(),
      };
    }),
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

  const parsed = invoiceCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const issueDate = parseYmd(data.issueDate);
  if (Number.isNaN(issueDate.getTime())) {
    return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });
  }

  let dueDate: Date | null = null;
  if (data.dueDate?.trim()) {
    const d = parseYmd(data.dueDate.trim());
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
    dueDate = d;
  }

  const [customer, companyProfile] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: data.customerId, userId: session.sub },
    }),
    prisma.companyProfile.findUnique({ where: { userId: session.sub } }),
  ]);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  const companyGstin = companyProfile?.gstin ?? null;

  if (data.quoteId) {
    const q = await prisma.quote.findFirst({
      where: { id: data.quoteId, userId: session.sub },
    });
    if (!q || q.customerId !== data.customerId) {
      return NextResponse.json({ error: "Invalid quote for this customer" }, { status: 400 });
    }
  }

  const invoiceNumber = data.invoiceNumber?.trim() || (await getNextInvoiceNumber(session.sub));

  const existing = await prisma.invoice.findUnique({
    where: { userId_invoiceNumber: { userId: session.sub, invoiceNumber } },
  });
  if (existing) {
    return NextResponse.json({ error: "Invoice number already in use" }, { status: 409 });
  }

  const built = await buildInvoiceLineRows(prisma, session.sub, customer, companyGstin, data.lines);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const { lineRows, subTotal, taxTotal, total } = built;
  const summaryView = computeInvoiceSummaryView(subTotal, taxTotal, data.adjustmentLabel, {
    discountPercent: data.discountPercent,
    withholdingType: data.withholdingType,
    withholdingPercent: data.withholdingPercent,
    adjustmentAmount: data.adjustmentAmount,
  });
  const status = data.status === "SENT" ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;
  const documentTemplateId = await resolveInvoiceTemplateId(prisma, session.sub, data.documentTemplateId);
  const fx = await resolveDocumentCurrencyForSave(prisma, session.sub, {
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    partyDefaultCurrency: customer.currency,
  });

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, session.sub);

      const inv = await tx.invoice.create({
        data: {
          userId: session.sub,
          customerId: data.customerId,
          documentTemplateId,
          invoiceNumber,
          reference: data.reference?.trim() ? data.reference.trim() : null,
          issueDate,
          dueDate,
          status,
          currency: fx.currency,
          exchangeRate: fx.exchangeRateDecimal,
          baseTotal: fx.baseTotalDecimal(summaryView.payableTotal),
          subTotal: new Prisma.Decimal(subTotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          total: new Prisma.Decimal(total),
          discountPercent: new Prisma.Decimal(summaryView.discountPercent),
          withholdingType: summaryView.withholdingType,
          withholdingPercent: new Prisma.Decimal(summaryView.withholdingPercent),
          adjustmentLabel: summaryView.adjustmentLabel,
          adjustmentAmount: new Prisma.Decimal(summaryView.adjustmentAmount),
          payableTotal: new Prisma.Decimal(summaryView.payableTotal),
          quoteId: data.quoteId ?? null,
          lines: { create: lineRows },
        },
      });

      if (status === InvoiceStatus.SENT) {
        await postInvoiceIssuance(tx, session.sub, inv.id);
      }

      return inv;
    });

    return NextResponse.json(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total,
        payableTotal: summaryView.payableTotal,
        status: invoice.status,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    const message =
      e instanceof Error && e.name === "PrismaClientValidationError"
        ? "Server schema out of date — restart the dev server, then try again."
        : e instanceof Error
          ? e.message
          : "Could not create invoice";
    return NextResponse.json({ error: message.includes("Could not") ? message : `Could not create invoice: ${message}` }, { status: 500 });
  }
}
