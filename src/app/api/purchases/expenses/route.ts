import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postPurchaseExpenseJournal } from "@/lib/accounting/purchases-posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { purchaseExpenseCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.purchaseExpense.findMany({
    where: { userId: session.sub },
    orderBy: { expenseDate: "desc" },
    take: 200,
    include: {
      expenseAccount: { select: { code: true, name: true } },
      bankAccount: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json({
    expenses: rows.map((e) => ({
      id: e.id,
      expenseDate: e.expenseDate.toISOString(),
      amount: Number(e.amount),
      taxAmount: Number(e.taxAmount),
      notes: e.notes,
      attachmentUrl: e.attachmentUrl,
      expenseAccountCode: e.expenseAccount.code,
      expenseAccountName: e.expenseAccount.name,
      bankAccountCode: e.bankAccount.code,
      posted: Boolean(e.journalEntryId),
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = purchaseExpenseCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const expenseDate = parseYmd(d.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const acctOk = await prisma.account.count({
    where: {
      userId: session.sub,
      id: { in: [d.expenseAccountId, d.bankAccountId] },
      isActive: true,
    },
  });
  if (acctOk !== 2) {
    return NextResponse.json({ error: "Invalid expense or bank account." }, { status: 400 });
  }

  if (d.vendorId) {
    const v = await prisma.vendor.findFirst({ where: { id: d.vendorId, userId: session.sub } });
    if (!v) return NextResponse.json({ error: "Invalid vendor." }, { status: 400 });
  }
  if (d.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: d.customerId, userId: session.sub } });
    if (!c) return NextResponse.json({ error: "Invalid customer." }, { status: 400 });
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, session.sub);
      const ex = await tx.purchaseExpense.create({
        data: {
          userId: session.sub,
          expenseDate,
          expenseAccountId: d.expenseAccountId,
          bankAccountId: d.bankAccountId,
          vendorId: d.vendorId?.trim() || null,
          customerId: d.customerId?.trim() || null,
          invoiceNumber: d.invoiceNumber?.trim() || null,
          amount: d.amount,
          taxAmount: d.taxAmount ?? 0,
          notes: d.notes?.trim() ?? null,
          attachmentUrl: d.attachmentUrl?.trim() ?? null,
        },
      });
      await postPurchaseExpenseJournal(tx, session.sub, ex.id);
      return ex;
    });

    return NextResponse.json({ expense: { id: expense.id } }, { status: 201 });
  } catch (e) {
    console.error("purchase expense create", e);
    const msg = e instanceof Error ? e.message : "Could not save expense.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
