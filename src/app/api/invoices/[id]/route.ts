import { InvoiceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { postInvoiceIssuance } from "@/lib/accounting/posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";
import { invoicePatchSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  ctx: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const inv = await prisma.invoice.findFirst({
    where: { id, userId: session.sub },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: "asc" } },
      allocations: true,
    },
  });

  if (!inv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allocated = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);

  return NextResponse.json({
    invoice: {
      ...inv,
      subTotal: Number(inv.subTotal),
      taxTotal: Number(inv.taxTotal),
      total: Number(inv.total),
      discountPercent: Number(inv.discountPercent),
      withholdingType: inv.withholdingType,
      withholdingPercent: Number(inv.withholdingPercent),
      adjustmentLabel: inv.adjustmentLabel,
      adjustmentAmount: Number(inv.adjustmentAmount),
      payableTotal: Number(inv.payableTotal),
      paid: allocated,
      balance: invoiceOpenAmount(inv) - allocated,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      lines: inv.lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        taxPercent: Number(l.taxPercent),
        lineNet: Number(l.lineNet),
        lineTax: Number(l.lineTax),
        lineTotal: Number(l.lineTotal),
      })),
    },
  });
}

export async function PATCH(
  request: Request,
  ctx: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = invoicePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inv = await prisma.invoice.findFirst({
    where: { id, userId: session.sub },
  });
  if (!inv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextStatus = parsed.data.status;
  if (!nextStatus) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: { status: nextStatus as InvoiceStatus },
      });

      if (nextStatus === InvoiceStatus.SENT && inv.status === InvoiceStatus.DRAFT) {
        await postInvoiceIssuance(tx, session.sub, id);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update invoice" }, { status: 500 });
  }
}
