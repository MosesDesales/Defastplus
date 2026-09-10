import { GstTaxPreference, Prisma, VendorBillStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postVendorBillJournal } from "@/lib/accounting/purchases-posting";
import { resolveInterStateForLine } from "@/lib/gst/item-gst";
import { splitTaxAmountIntoComponents } from "@/lib/gst/line-india-tax";
import { isInterState } from "@/lib/gst/split";
import { resolveDocumentCurrencyForSave } from "@/lib/currencies/document-currency";
import { computeBillLineAmounts, round2 } from "@/lib/purchases/line-math";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { vendorBillUpsertSchema } from "@/lib/validators";

async function nextBillNumber(userId: string) {
  const n = await prisma.vendorBill.count({ where: { userId } });
  return `BILL-${String(n + 1).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId") ?? undefined;
  const status = searchParams.get("status")?.trim();

  const bills = await prisma.vendorBill.findMany({
    where: {
      userId: session.sub,
      ...(vendorId ? { vendorId } : {}),
      ...(status ? { status: status as VendorBillStatus } : {}),
    },
    orderBy: { billDate: "desc" },
    take: 300,
    include: {
      vendor: { select: { displayName: true, email: true } },
      paymentAllocations: true,
      creditApplications: true,
    },
  });

  return NextResponse.json({
    bills: bills.map((b) => {
      const paid =
        b.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
        b.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: b.id,
        billNumber: b.billNumber,
        billDate: b.billDate.toISOString(),
        dueDate: b.dueDate?.toISOString() ?? null,
        vendorId: b.vendorId,
        vendorName: b.vendor.displayName,
        vendorEmail: b.vendor.email,
        status: b.status,
        total: Number(b.total),
        paid,
        balance: Number(b.total) - paid,
        currency: b.currency,
        exchangeRate: b.exchangeRate != null ? Number(b.exchangeRate) : null,
        baseTotal: b.baseTotal != null ? Number(b.baseTotal) : null,
        purchaseOrderId: b.purchaseOrderId,
        posted: Boolean(b.journalEntryId),
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorBillUpsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const billDate = parseYmd(data.billDate);
  if (Number.isNaN(billDate.getTime())) return NextResponse.json({ error: "Invalid bill date" }, { status: 400 });

  let dueDate: Date | null = null;
  if (data.dueDate?.trim()) {
    dueDate = parseYmd(data.dueDate.trim());
    if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
  }

  const [vendor, companyProfile] = await Promise.all([
    prisma.vendor.findFirst({
      where: { id: data.vendorId, userId: session.sub },
    }),
    prisma.companyProfile.findUnique({ where: { userId: session.sub } }),
  ]);
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  const companyGstin = companyProfile?.gstin ?? null;

  if (data.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: data.purchaseOrderId, userId: session.sub, vendorId: data.vendorId },
    });
    if (!po) return NextResponse.json({ error: "Invalid purchase order" }, { status: 400 });
  }

  const requestedStatus = data.status ?? VendorBillStatus.UNPAID;
  const status =
    requestedStatus === VendorBillStatus.DRAFT ? VendorBillStatus.DRAFT : VendorBillStatus.UNPAID;

  let apAccountId: string | null = data.accountsPayableAccountId?.trim() || null;
  if (apAccountId) {
    const ap = await prisma.account.findFirst({
      where: { id: apAccountId, userId: session.sub, type: "LIABILITY", isActive: true },
    });
    if (!ap) return NextResponse.json({ error: "Invalid Accounts Payable account" }, { status: 400 });
  }

  let subTotal = 0;
  let taxTotal = 0;
  let lineTotalsSum = 0;
  const lineRows: Array<{
    itemId: string | null;
    customerId: string | null;
    description: string;
    quantity: Prisma.Decimal;
    rate: Prisma.Decimal;
    discountPercent: Prisma.Decimal;
    taxPercent: Prisma.Decimal;
    lineNet: Prisma.Decimal;
    lineTax: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    lineCgst: Prisma.Decimal;
    lineSgst: Prisma.Decimal;
    lineIgst: Prisma.Decimal;
    expenseAccountId: string | null;
    sortOrder: number;
  }> = [];

  const customerIds = [...new Set(data.lines.map((l) => l.customerId).filter(Boolean))] as string[];
  for (const cid of customerIds) {
    const ok = await prisma.customer.findFirst({ where: { id: cid, userId: session.sub } });
    if (!ok) return NextResponse.json({ error: "Invalid customer on a line" }, { status: 400 });
  }

  const billItemIds = [...new Set(data.lines.map((l) => l.itemId?.trim()).filter(Boolean))] as string[];
  const billItems =
    billItemIds.length > 0
      ? await prisma.item.findMany({ where: { userId: session.sub, id: { in: billItemIds } } })
      : [];
  const billItemsById = new Map(billItems.map((it) => [it.id, it]));

  for (let i = 0; i < data.lines.length; i++) {
    const l = data.lines[i]!;
    const qty = Number(l.quantity);
    const rate = Number(l.rate);
    const discP = l.discountPercent ?? 0;
    const itemIdTrim = l.itemId?.trim() || null;
    const itemRow = itemIdTrim ? billItemsById.get(itemIdTrim) : undefined;
    if (itemIdTrim && !itemRow) {
      return NextResponse.json({ error: `Unknown item on line ${i + 1}` }, { status: 400 });
    }
    let taxP = Number(l.taxPercent ?? 0);
    if (itemRow) {
      if (itemRow.gstTaxPreference !== GstTaxPreference.TAXABLE || !itemRow.gstApplicable) {
        taxP = 0;
      } else if (!itemRow.hsnCode?.trim()) {
        return NextResponse.json(
          { error: `Item "${itemRow.name}" is taxable but missing HSN/SAC in the catalog.` },
          { status: 400 },
        );
      }
    }
    const { lineNet, lineTax, lineTotal } = computeBillLineAmounts(qty, rate, discP, taxP);
    subTotal += Number(lineNet);
    taxTotal += Number(lineTax);
    lineTotalsSum += Number(lineTotal);

    let expenseAccountId: string | null = l.expenseAccountId?.trim() || null;
    if (expenseAccountId) {
      const ok = await prisma.account.findFirst({
        where: { id: expenseAccountId, userId: session.sub, type: "EXPENSE", isActive: true },
      });
      if (!ok) return NextResponse.json({ error: `Invalid expense account on line ${i + 1}` }, { status: 400 });
    }

    const inter = itemRow
      ? resolveInterStateForLine(itemRow.gstTaxMode, companyGstin, vendor.gstin)
      : isInterState(companyGstin, vendor.gstin);
    const gstSplit = splitTaxAmountIntoComponents(Number(lineTax), inter);

    lineRows.push({
      itemId: itemIdTrim,
      customerId: l.customerId?.trim() || null,
      description: l.description.trim(),
      quantity: new Prisma.Decimal(qty),
      rate: new Prisma.Decimal(rate),
      discountPercent: new Prisma.Decimal(discP),
      taxPercent: new Prisma.Decimal(taxP),
      lineNet,
      lineTax,
      lineTotal,
      lineCgst: new Prisma.Decimal(gstSplit.cgst),
      lineSgst: new Prisma.Decimal(gstSplit.sgst),
      lineIgst: new Prisma.Decimal(gstSplit.igst),
      expenseAccountId,
      sortOrder: l.sortOrder ?? i,
    });
  }

  const adj = Number(data.adjustmentAmount ?? 0);
  const wh = Number(data.withholdingAmount ?? 0);
  const grandTotal = round2(lineTotalsSum + adj - wh);

  const fx = await resolveDocumentCurrencyForSave(prisma, session.sub, {
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    partyDefaultCurrency: vendor.currency,
  });

  const billNumber = data.billNumber?.trim() || (await nextBillNumber(session.sub));
  const clash = await prisma.vendorBill.findUnique({
    where: { userId_billNumber: { userId: session.sub, billNumber } },
  });
  if (clash) return NextResponse.json({ error: "Bill number already in use" }, { status: 409 });

  const bill = await prisma.$transaction(async (tx) => {
    await ensureDefaultAccounts(tx, session.sub);

    const b = await tx.vendorBill.create({
      data: {
        userId: session.sub,
        vendorId: data.vendorId,
        billNumber,
        reference: data.reference?.trim() ?? null,
        orderNumber: data.orderNumber?.trim() ?? null,
        subject: data.subject?.trim() ?? null,
        billDate,
        dueDate,
        paymentTerms: data.paymentTerms?.trim() ?? "DUE_ON_RECEIPT",
        accountsPayableAccountId: apAccountId,
        notesInternal: data.notesInternal?.trim() ?? null,
        status,
        currency: fx.currency,
        exchangeRate: fx.exchangeRateDecimal,
        baseTotal: fx.baseTotalDecimal(grandTotal),
        subTotal: new Prisma.Decimal(subTotal),
        taxTotal: new Prisma.Decimal(taxTotal),
        total: new Prisma.Decimal(grandTotal),
        withholdingType: data.withholdingType ?? "NONE",
        withholdingAmount: new Prisma.Decimal(wh),
        adjustmentAmount: new Prisma.Decimal(adj),
        pdfTemplate: data.pdfTemplate?.trim() || "Standard Template",
        purchaseOrderId: data.purchaseOrderId ?? null,
        lines: { create: lineRows },
      },
    });

    if (data.purchaseOrderId) {
      await tx.purchaseOrder.updateMany({
        where: { id: data.purchaseOrderId, userId: session.sub },
        data: { status: "BILLED" },
      });
    }

    if (b.status !== VendorBillStatus.DRAFT && b.status !== VendorBillStatus.VOID) {
      await postVendorBillJournal(tx, session.sub, b.id);
    }

    return b;
  });

  return NextResponse.json({ bill: { id: bill.id, billNumber: bill.billNumber } }, { status: 201 });
}
