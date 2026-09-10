import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { quoteCreateSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiModules(session.sub, "quotes");
  if (denied) return denied;

  const quotes = await prisma.quote.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { displayName: true } },
    },
    take: 200,
  });

  return NextResponse.json({
    quotes: quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      quoteDate: q.quoteDate.toISOString(),
      customerName: q.customer.displayName,
      total: Number(q.total),
      status: q.status,
      updatedAt: q.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiModules(session.sub, "quotes");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quoteCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const quoteDate = parseYmd(data.quoteDate);
  if (Number.isNaN(quoteDate.getTime())) {
    return NextResponse.json({ error: "Invalid quote date" }, { status: 400 });
  }

  let expiryDate: Date | null = null;
  if (data.expiryDate?.trim()) {
    const exp = parseYmd(data.expiryDate.trim());
    if (Number.isNaN(exp.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }
    expiryDate = exp;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, userId: session.sub },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const itemIds = [...new Set(data.lines.map((l) => l.itemId).filter(Boolean) as string[])];
  if (itemIds.length > 0) {
    const okItems = await prisma.item.count({
      where: { userId: session.sub, id: { in: itemIds } },
    });
    if (okItems !== itemIds.length) {
      return NextResponse.json({ error: "One or more items are invalid" }, { status: 400 });
    }
  }

  const linesComputed = data.lines.map((l, idx) => {
    const qty = l.quantity;
    const rate = l.rate;
    const amount = round2(qty * rate);
    return {
      itemId: l.itemId ?? null,
      description: l.description.trim(),
      quantity: new Prisma.Decimal(qty),
      rate: new Prisma.Decimal(rate),
      amount: new Prisma.Decimal(amount),
      sortOrder: idx,
    };
  });

  const subTotal = round2(linesComputed.reduce((s, l) => s + Number(l.amount), 0));

  let discountAmount = 0;
  if (data.discountMode === "PERCENT") {
    discountAmount = round2((subTotal * data.discountInput) / 100);
  } else {
    discountAmount = round2(data.discountInput);
  }
  discountAmount = Math.min(discountAmount, subTotal);

  let total = round2(subTotal - discountAmount + data.adjustmentAmount);
  const tax = data.taxAmount;
  if (data.withholdingType === "TDS") {
    total = round2(total - tax);
  } else if (data.withholdingType === "TCS") {
    total = round2(total + tax);
  }

  const existing = await prisma.quote.findUnique({
    where: {
      userId_quoteNumber: { userId: session.sub, quoteNumber: data.quoteNumber.trim() },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Quote number already in use" }, { status: 409 });
  }

  try {
    const quote = await prisma.quote.create({
      data: {
        userId: session.sub,
        customerId: data.customerId,
        quoteNumber: data.quoteNumber.trim(),
        reference: data.reference?.trim() ? data.reference.trim() : null,
        quoteDate,
        expiryDate,
        salesperson: data.salesperson?.trim() ? data.salesperson.trim() : null,
        projectName: data.projectName?.trim() ? data.projectName.trim() : null,
        subject: data.subject?.trim() ? data.subject.trim() : null,
        customerNotes: data.customerNotes?.trim() ? data.customerNotes.trim() : null,
        termsAndConditions: data.termsAndConditions?.trim() ? data.termsAndConditions.trim() : null,
        subTotal: new Prisma.Decimal(subTotal),
        discountMode: data.discountMode,
        discountInput: new Prisma.Decimal(data.discountInput),
        discountAmount: new Prisma.Decimal(discountAmount),
        withholdingType: data.withholdingType,
        taxSelectLabel: data.taxSelectLabel?.trim() ? data.taxSelectLabel.trim() : null,
        taxAmount: new Prisma.Decimal(tax),
        adjustmentLabel: data.adjustmentLabel.trim() || "Adjustment",
        adjustmentAmount: new Prisma.Decimal(data.adjustmentAmount),
        total: new Prisma.Decimal(total),
        pdfTemplate: data.pdfTemplate.trim() || "Spreadsheet Template",
        status: data.status,
        lines: {
          create: linesComputed.map((l) => ({
            itemId: l.itemId,
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
            amount: l.amount,
            sortOrder: l.sortOrder,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ id: quote.id, quoteNumber: quote.quoteNumber, total: Number(quote.total) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create quote" }, { status: 500 });
  }
}
