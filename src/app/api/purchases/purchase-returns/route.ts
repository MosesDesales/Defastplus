import { Prisma, PurchaseReturnStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getNextPurchaseReturnNumber } from "@/lib/document-numbers";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { buildInvoiceLineRows } from "@/lib/sales/invoice-line-build";
import { getSession } from "@/lib/session";
import { purchaseReturnCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.purchaseReturn.findMany({
    where: { userId: session.sub },
    orderBy: { returnDate: "desc" },
    take: 300,
    include: { vendor: { select: { displayName: true } } },
  });

  return NextResponse.json({
    returns: rows.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      returnDate: r.returnDate.toISOString(),
      vendorId: r.vendorId,
      vendorName: r.vendor.displayName,
      status: r.status,
      total: Number(r.total),
      reason: r.reason,
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = purchaseReturnCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const returnDate = parseYmd(d.returnDate);
  if (Number.isNaN(returnDate.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const vendor = await prisma.vendor.findFirst({ where: { id: d.vendorId, userId: session.sub } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const profile = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  const built = await buildInvoiceLineRows(
    prisma,
    session.sub,
    { gstin: vendor.gstin },
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

  const returnNumber = d.returnNumber?.trim() || (await getNextPurchaseReturnNumber(session.sub));
  const clash = await prisma.purchaseReturn.findUnique({
    where: { userId_returnNumber: { userId: session.sub, returnNumber } },
  });
  if (clash) return NextResponse.json({ error: "Return number already in use" }, { status: 409 });

  const status = d.dispatchNow ? PurchaseReturnStatus.DISPATCHED : PurchaseReturnStatus.DRAFT;

  const ret = await prisma.purchaseReturn.create({
    data: {
      userId: session.sub,
      vendorId: d.vendorId,
      returnNumber,
      returnDate,
      reference: d.reference?.trim() ?? null,
      reason: d.reason?.trim() ?? null,
      vendorBillId: d.vendorBillId ?? null,
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

  return NextResponse.json({ purchaseReturn: { id: ret.id, returnNumber: ret.returnNumber } }, { status: 201 });
}
