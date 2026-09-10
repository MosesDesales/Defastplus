import { PurchaseOrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "purchase_order");
  if (denied) return denied;
  const { id } = await ctx.params;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, userId: session.sub },
    include: {
      vendor: { select: { displayName: true } },
      poLines: { orderBy: { sortOrder: "asc" } },
      bills: { select: { id: true, billNumber: true, total: true, status: true } },
    },
  });

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    purchaseOrder: {
      id: po.id,
      poNumber: po.poNumber,
      reference: po.reference,
      poDate: po.poDate.toISOString(),
      expectedDate: po.expectedDate?.toISOString() ?? null,
      status: po.status,
      memo: po.memo,
      vendorId: po.vendorId,
      vendorName: po.vendor.displayName,
      subTotal: Number(po.subTotal),
      taxTotal: Number(po.taxTotal),
      total: Number(po.total),
      currency: po.currency,
      exchangeRate: po.exchangeRate != null ? Number(po.exchangeRate) : null,
      baseTotal: po.baseTotal != null ? Number(po.baseTotal) : null,
      deliveryMode: po.deliveryMode,
      deliveryCustomerId: po.deliveryCustomerId,
      deliverySnapshot: po.deliverySnapshot,
      paymentTerms: po.paymentTerms,
      shipmentPreference: po.shipmentPreference,
      termsAndConditions: po.termsAndConditions,
      discountPercent: Number(po.discountPercent),
      adjustmentAmount: Number(po.adjustmentAmount),
      withholdingType: po.withholdingType,
      withholdingAmount: Number(po.withholdingAmount),
      pdfTemplate: po.pdfTemplate,
      lines: po.poLines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        expenseAccountId: l.expenseAccountId,
        description: l.description,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        amount: Number(l.amount),
        taxPercent: Number(l.taxPercent),
        sortOrder: l.sortOrder,
      })),
      bills: po.bills,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "purchase_order");
  if (denied) return denied;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = json as { status?: PurchaseOrderStatus };
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, userId: session.sub },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.status !== undefined) {
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: body.status },
    });
  }

  return NextResponse.json({ ok: true });
}
