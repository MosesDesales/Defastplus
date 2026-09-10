import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { recurringExpenseSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

async function assertVendorCustomer(userId: string, vendorId: string | null | undefined, customerId: string | null | undefined) {
  if (vendorId) {
    const v = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
    if (!v) return false;
  }
  if (customerId) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, userId } });
    if (!c) return false;
  }
  return true;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_expense");
  if (denied) return denied;

  const rows = await prisma.recurringExpense.findMany({
    where: { userId: session.sub },
    orderBy: { nextRunDate: "asc" },
    include: {
      expenseAccount: { select: { code: true, name: true } },
      bankAccount: { select: { code: true, name: true } },
      vendor: { select: { id: true, displayName: true } },
      customer: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({
    recurringExpenses: rows.map((r) => ({
      id: r.id,
      frequency: r.frequency,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      nextRunDate: r.nextRunDate.toISOString(),
      isActive: r.isActive,
      amount: Number(r.amount),
      taxAmount: Number(r.taxAmount),
      notes: r.notes,
      vendorId: r.vendorId,
      vendorName: r.vendor?.displayName ?? null,
      customerId: r.customerId,
      customerName: r.customer?.displayName ?? null,
      expenseAccountCode: r.expenseAccount.code,
      bankAccountCode: r.bankAccount.code,
      lastGeneratedAt: r.lastGeneratedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_expense");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recurringExpenseSchema.safeParse(json);
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

  const acctOk = await prisma.account.count({
    where: {
      userId: session.sub,
      id: { in: [d.expenseAccountId, d.bankAccountId] },
      isActive: true,
    },
  });
  if (acctOk !== 2) return NextResponse.json({ error: "Invalid accounts" }, { status: 400 });

  if (!(await assertVendorCustomer(session.sub, d.vendorId ?? null, d.customerId ?? null))) {
    return NextResponse.json({ error: "Invalid vendor or customer" }, { status: 400 });
  }

  const row = await prisma.recurringExpense.create({
    data: {
      userId: session.sub,
      frequency: d.frequency,
      startDate,
      endDate,
      nextRunDate: startDate,
      isActive: d.isActive ?? true,
      expenseAccountId: d.expenseAccountId,
      bankAccountId: d.bankAccountId,
      vendorId: d.vendorId?.trim() || null,
      customerId: d.customerId?.trim() || null,
      amount: d.amount,
      taxAmount: d.taxAmount ?? 0,
      notes: d.notes?.trim() ?? null,
    },
  });

  return NextResponse.json({ recurringExpense: { id: row.id } }, { status: 201 });
}
