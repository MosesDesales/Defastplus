import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { recurringExpensePatchSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_expense");
  if (denied) return denied;
  const { id } = await ctx.params;

  const r = await prisma.recurringExpense.findFirst({
    where: { id, userId: session.sub },
    include: {
      expenseAccount: { select: { id: true, code: true, name: true } },
      bankAccount: { select: { id: true, code: true, name: true } },
      vendor: { select: { id: true, displayName: true } },
      customer: { select: { id: true, displayName: true } },
    },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    recurringExpense: {
      id: r.id,
      frequency: r.frequency,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate?.toISOString().slice(0, 10) ?? "",
      nextRunDate: r.nextRunDate.toISOString(),
      isActive: r.isActive,
      expenseAccountId: r.expenseAccountId,
      bankAccountId: r.bankAccountId,
      vendorId: r.vendorId,
      vendorLabel: r.vendor?.displayName ?? "",
      customerId: r.customerId,
      customerLabel: r.customer?.displayName ?? "",
      amount: Number(r.amount),
      taxAmount: Number(r.taxAmount),
      notes: r.notes,
      expenseAccount: r.expenseAccount,
      bankAccount: r.bankAccount,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_expense");
  if (denied) return denied;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recurringExpensePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.recurringExpense.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;

  if (d.expenseAccountId !== undefined || d.bankAccountId !== undefined) {
    const expId = d.expenseAccountId ?? existing.expenseAccountId;
    const bankId = d.bankAccountId ?? existing.bankAccountId;
    const acctOk = await prisma.account.count({
      where: {
        userId: session.sub,
        id: { in: [expId, bankId] },
        isActive: true,
      },
    });
    if (acctOk !== 2) return NextResponse.json({ error: "Invalid accounts" }, { status: 400 });
  }

  if (!(await assertVendorCustomer(session.sub, d.vendorId ?? existing.vendorId, d.customerId ?? existing.customerId))) {
    return NextResponse.json({ error: "Invalid vendor or customer" }, { status: 400 });
  }

  let startDate = existing.startDate;
  if (d.startDate !== undefined) {
    const sd = parseYmd(d.startDate);
    if (Number.isNaN(sd.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    startDate = sd;
  }

  let endDate: Date | null = existing.endDate;
  if (d.endDate !== undefined) {
    if (!d.endDate?.trim()) endDate = null;
    else {
      const ed = parseYmd(d.endDate.trim());
      if (Number.isNaN(ed.getTime())) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
      endDate = ed;
    }
  }

  await prisma.recurringExpense.update({
    where: { id },
    data: {
      ...(d.frequency !== undefined ? { frequency: d.frequency } : {}),
      ...(d.startDate !== undefined ? { startDate } : {}),
      ...(d.endDate !== undefined ? { endDate } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.expenseAccountId !== undefined ? { expenseAccountId: d.expenseAccountId } : {}),
      ...(d.bankAccountId !== undefined ? { bankAccountId: d.bankAccountId } : {}),
      ...(d.vendorId !== undefined ? { vendorId: d.vendorId?.trim() || null } : {}),
      ...(d.customerId !== undefined ? { customerId: d.customerId?.trim() || null } : {}),
      ...(d.amount !== undefined ? { amount: d.amount } : {}),
      ...(d.taxAmount !== undefined ? { taxAmount: d.taxAmount ?? 0 } : {}),
      ...(d.notes !== undefined ? { notes: d.notes?.trim() ?? null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
