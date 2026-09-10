import { DeliveryChallanStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { getNextChallanNumber } from "@/lib/document-numbers";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { buildInvoiceLineRows } from "@/lib/sales/invoice-line-build";
import { getSession } from "@/lib/session";
import { deliveryChallanCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "delivery_challan");
  if (denied) return denied;

  const rows = await prisma.deliveryChallan.findMany({
    where: { userId: session.sub },
    orderBy: { challanDate: "desc" },
    take: 300,
    include: { customer: { select: { displayName: true } } },
  });

  return NextResponse.json({
    challans: rows.map((c) => ({
      id: c.id,
      challanNumber: c.challanNumber,
      challanDate: c.challanDate.toISOString(),
      customerId: c.customerId,
      customerName: c.customer.displayName,
      status: c.status,
      total: Number(c.total),
      reference: c.reference,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "delivery_challan");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deliveryChallanCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const challanDate = parseYmd(d.challanDate);
  if (Number.isNaN(challanDate.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: session.sub } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const profile = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  const built = await buildInvoiceLineRows(
    prisma,
    session.sub,
    customer,
    profile?.gstin ?? null,
    d.lines.map((l) => ({
      itemId: l.itemId,
      description: l.description,
      quantity: l.quantity,
      rate: l.rate,
      taxPercent: l.taxPercent,
    })),
  );
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const challanNumber = d.challanNumber?.trim() || (await getNextChallanNumber(session.sub));
  const clash = await prisma.deliveryChallan.findUnique({
    where: { userId_challanNumber: { userId: session.sub, challanNumber } },
  });
  if (clash) return NextResponse.json({ error: "Challan number already in use" }, { status: 409 });

  const status = d.dispatchNow ? DeliveryChallanStatus.DISPATCHED : DeliveryChallanStatus.DRAFT;

  const challan = await prisma.deliveryChallan.create({
    data: {
      userId: session.sub,
      customerId: d.customerId,
      challanNumber,
      challanDate,
      reference: d.reference?.trim() ?? null,
      notes: d.notes?.trim() ?? null,
      invoiceId: d.invoiceId ?? null,
      status,
      subTotal: new Prisma.Decimal(built.subTotal),
      taxTotal: new Prisma.Decimal(built.taxTotal),
      total: new Prisma.Decimal(built.total),
      lines: {
        create: built.lineRows.map((r) => ({
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
        })),
      },
    },
  });

  return NextResponse.json({ challan: { id: challan.id, challanNumber: challan.challanNumber } }, { status: 201 });
}
