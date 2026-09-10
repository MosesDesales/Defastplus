import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { recurringVendorBillSchema } from "@/lib/validators";
import { advanceRecurringDate } from "@/lib/purchases/recurring-dates";
import { requireApiModules } from "@/lib/api-require-module";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_bills");
  if (denied) return denied;

  const rows = await prisma.recurringVendorBill.findMany({
    where: { userId: session.sub },
    include: { vendor: { select: { displayName: true } }, lines: true },
    orderBy: { nextRunDate: "asc" },
  });

  return NextResponse.json({
    recurringBills: rows.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      vendorName: r.vendor.displayName,
      profileName: r.profileName,
      frequency: r.frequency,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      nextRunDate: r.nextRunDate.toISOString(),
      isActive: r.isActive,
      memo: r.memo,
      lineCount: r.lines.length,
      lastGeneratedAt: r.lastGeneratedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_bills");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recurringVendorBillSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const startDate = parseYmd(d.startDate);
  if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });

  let endDate: Date | null = null;
  if (d.endDate?.trim()) {
    endDate = parseYmd(d.endDate.trim());
    if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: d.vendorId, userId: session.sub },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  let apAccountId: string | null = d.accountsPayableAccountId?.trim() || null;
  if (apAccountId) {
    const ap = await prisma.account.findFirst({
      where: { id: apAccountId, userId: session.sub, type: "LIABILITY", isActive: true },
    });
    if (!ap) return NextResponse.json({ error: "Invalid Accounts Payable account" }, { status: 400 });
  }

  const customerIds = [...new Set(d.lines.map((l) => l.customerId).filter(Boolean))] as string[];
  for (const cid of customerIds) {
    const ok = await prisma.customer.findFirst({ where: { id: cid, userId: session.sub } });
    if (!ok) return NextResponse.json({ error: "Invalid customer on a line" }, { status: 400 });
  }

  const lines: Array<{
    itemId: string | null;
    customerId: string | null;
    description: string;
    quantity: number;
    rate: number;
    discountPercent: number;
    taxPercent: number;
    expenseAccountId: string | null;
    sortOrder: number;
  }> = [];

  for (let i = 0; i < d.lines.length; i++) {
    const l = d.lines[i]!;
    let expenseAccountId: string | null = l.expenseAccountId ?? null;
    if (expenseAccountId) {
      const ok = await prisma.account.findFirst({
        where: { id: expenseAccountId, userId: session.sub, type: "EXPENSE", isActive: true },
      });
      if (!ok) return NextResponse.json({ error: `Invalid expense account on line ${i + 1}` }, { status: 400 });
    }
    let itemId: string | null = l.itemId?.trim() || null;
    if (itemId) {
      const ok = await prisma.item.findFirst({ where: { id: itemId, userId: session.sub } });
      if (!ok) return NextResponse.json({ error: `Invalid item on line ${i + 1}` }, { status: 400 });
    }
    lines.push({
      itemId,
      customerId: l.customerId?.trim() || null,
      description: l.description.trim(),
      quantity: l.quantity ?? 1,
      rate: l.rate,
      discountPercent: l.discountPercent ?? 0,
      taxPercent: l.taxPercent ?? 0,
      expenseAccountId,
      sortOrder: l.sortOrder ?? i,
    });
  }

  const notesInternal = d.notesInternal?.trim() ?? null;
  const memoLegacy = d.memo?.trim() ?? null;

  const row = await prisma.recurringVendorBill.create({
    data: {
      userId: session.sub,
      vendorId: d.vendorId,
      profileName: d.profileName.trim(),
      frequency: d.frequency,
      startDate,
      endDate,
      nextRunDate: startDate,
      isActive: d.isActive ?? true,
      paymentTerms: d.paymentTerms?.trim() ?? "DUE_ON_RECEIPT",
      accountsPayableAccountId: apAccountId,
      notesInternal: notesInternal ?? memoLegacy,
      memo: memoLegacy,
      discountPercent: d.discountPercent ?? 0,
      withholdingType: d.withholdingType ?? "NONE",
      withholdingAmount: d.withholdingAmount ?? 0,
      adjustmentAmount: d.adjustmentAmount ?? 0,
      lines: {
        create: lines.map((l) => ({
          itemId: l.itemId,
          customerId: l.customerId,
          description: l.description,
          quantity: l.quantity,
          rate: l.rate,
          discountPercent: l.discountPercent,
          taxPercent: l.taxPercent,
          expenseAccountId: l.expenseAccountId,
          sortOrder: l.sortOrder,
        })),
      },
    },
  });

  return NextResponse.json({ recurringBill: { id: row.id } }, { status: 201 });
}
