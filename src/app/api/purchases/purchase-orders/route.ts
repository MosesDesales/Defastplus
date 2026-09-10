import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { resolveDocumentCurrencyForSave } from "@/lib/currencies/document-currency";
import { computeLineAmounts, round2 } from "@/lib/purchases/line-math";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { purchaseOrderUpsertSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

async function nextPoNumber(userId: string) {
  const n = await prisma.purchaseOrder.count({ where: { userId } });
  return `PO-${String(n + 1).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "purchase_order");
  if (denied) return denied;

  const vendorId = new URL(request.url).searchParams.get("vendorId") ?? undefined;
  const status = new URL(request.url).searchParams.get("status")?.trim();

  const rows = await prisma.purchaseOrder.findMany({
    where: {
      userId: session.sub,
      ...(vendorId ? { vendorId } : {}),
      ...(status ? { status: status as PurchaseOrderStatus } : {}),
    },
    orderBy: { poDate: "desc" },
    take: 200,
    include: {
      vendor: { select: { displayName: true } },
      poLines: true,
    },
  });

  return NextResponse.json({
    purchaseOrders: rows.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      poDate: p.poDate.toISOString(),
      vendorId: p.vendorId,
      vendorName: p.vendor.displayName,
      status: p.status,
      currency: p.currency,
      exchangeRate: p.exchangeRate != null ? Number(p.exchangeRate) : null,
      baseTotal: p.baseTotal != null ? Number(p.baseTotal) : null,
      total: Number(p.total),
      lineCount: p.poLines.length,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "purchase_order");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = purchaseOrderUpsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const poDate = parseYmd(data.poDate);
  if (Number.isNaN(poDate.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  let expectedDate: Date | null = null;
  if (data.expectedDate?.trim()) {
    expectedDate = parseYmd(data.expectedDate.trim());
    if (Number.isNaN(expectedDate.getTime())) return NextResponse.json({ error: "Invalid expected date" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: data.vendorId, userId: session.sub },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const deliveryMode = data.deliveryMode ?? "ORGANIZATION";
  let deliveryCustomerId: string | null = null;
  if (deliveryMode === "CUSTOMER") {
    deliveryCustomerId = data.deliveryCustomerId?.trim() || null;
    if (deliveryCustomerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: deliveryCustomerId, userId: session.sub },
      });
      if (!cust) return NextResponse.json({ error: "Invalid delivery customer" }, { status: 400 });
    }
  }

  const expenseIds = [...new Set(data.lines.map((l) => l.expenseAccountId).filter(Boolean))] as string[];
  if (expenseIds.length > 0) {
    const expOk = await prisma.account.count({
      where: {
        userId: session.sub,
        id: { in: expenseIds },
        type: "EXPENSE",
        isActive: true,
      },
    });
    if (expOk !== expenseIds.length) {
      return NextResponse.json({ error: "Invalid expense account on one or more lines" }, { status: 400 });
    }
  }

  let lineNetSum = 0;
  let taxSum = 0;
  const lineRows: Array<{
    itemId: string | null;
    expenseAccountId: string | null;
    description: string;
    quantity: Prisma.Decimal;
    rate: Prisma.Decimal;
    amount: Prisma.Decimal;
    taxPercent: Prisma.Decimal;
    sortOrder: number;
  }> = [];

  for (let i = 0; i < data.lines.length; i++) {
    const l = data.lines[i]!;
    const qty = Number(l.quantity);
    const rate = Number(l.rate);
    const taxP = l.taxPercent ?? 0;
    const { lineNet, lineTax, lineTotal } = computeLineAmounts(qty, rate, taxP);
    lineNetSum += Number(lineNet);
    taxSum += Number(lineTax);

    lineRows.push({
      itemId: l.itemId ?? null,
      expenseAccountId: l.expenseAccountId?.trim() || null,
      description: l.description.trim(),
      quantity: new Prisma.Decimal(qty),
      rate: new Prisma.Decimal(rate),
      amount: lineTotal,
      taxPercent: new Prisma.Decimal(taxP),
      sortOrder: l.sortOrder ?? i,
    });
  }

  const dp = Number(data.discountPercent ?? 0);
  const discountAmt = round2(lineNetSum * (dp / 100));
  const netAfterDiscount = round2(lineNetSum - discountAmt);
  const adj = Number(data.adjustmentAmount ?? 0);
  const wh = Number(data.withholdingAmount ?? 0);
  const grandTotal = round2(netAfterDiscount + taxSum + adj - wh);

  const fx = await resolveDocumentCurrencyForSave(prisma, session.sub, {
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    partyDefaultCurrency: vendor.currency,
  });

  const poNumber = data.poNumber?.trim() || (await nextPoNumber(session.sub));
  const clash = await prisma.purchaseOrder.findUnique({
    where: { userId_poNumber: { userId: session.sub, poNumber } },
  });
  if (clash) return NextResponse.json({ error: "PO number in use" }, { status: 409 });

  const po = await prisma.purchaseOrder.create({
    data: {
      userId: session.sub,
      vendorId: data.vendorId,
      poNumber,
      reference: data.reference?.trim() ?? null,
      poDate,
      expectedDate,
      status: data.status ?? PurchaseOrderStatus.DRAFT,
      currency: fx.currency,
      exchangeRate: fx.exchangeRateDecimal,
      baseTotal: fx.baseTotalDecimal(grandTotal),
      subTotal: new Prisma.Decimal(lineNetSum),
      taxTotal: new Prisma.Decimal(taxSum),
      total: new Prisma.Decimal(grandTotal),
      memo: data.memo?.trim() ?? null,
      deliveryMode,
      deliveryCustomerId: deliveryMode === "CUSTOMER" ? deliveryCustomerId : null,
      deliverySnapshot: data.deliverySnapshot?.trim() ?? null,
      paymentTerms: data.paymentTerms?.trim() ?? "DUE_ON_RECEIPT",
      shipmentPreference: data.shipmentPreference?.trim() ?? null,
      termsAndConditions: data.termsAndConditions?.trim() ?? null,
      discountPercent: new Prisma.Decimal(dp),
      adjustmentAmount: new Prisma.Decimal(adj),
      withholdingType: data.withholdingType ?? "NONE",
      withholdingAmount: new Prisma.Decimal(wh),
      pdfTemplate: data.pdfTemplate?.trim() || "Standard Template",
      poLines: { create: lineRows },
    },
  });

  return NextResponse.json({ purchaseOrder: { id: po.id, poNumber } }, { status: 201 });
}
