import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { bankingAccountCreateSchema } from "@/lib/validators";
import { parseYmd } from "@/lib/dates";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.bankingAccount.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    include: {
      chartAccount: { select: { id: true, code: true, name: true } },
    },
  });

  const out = await Promise.all(
    accounts.map(async (a) => {
      const agg = await prisma.bankingTransaction.aggregate({
        where: { bankingAccountId: a.id },
        _sum: { credit: true, debit: true },
      });
      const credit = Number(agg._sum.credit ?? 0);
      const debit = Number(agg._sum.debit ?? 0);
      const balance = Number(a.openingBalance) + credit - debit;
      const unreconciled = await prisma.bankingTransaction.count({
        where: { bankingAccountId: a.id, status: { not: "RECONCILED" } },
      });
      const lastImport = await prisma.bankStatementImport.findFirst({
        where: { bankingAccountId: a.id },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true },
      });
      return {
        id: a.id,
        bankName: a.bankName,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        routingOrIfsc: a.routingOrIfsc,
        currency: a.currency,
        kind: a.kind,
        status: a.status,
        openingBalance: Number(a.openingBalance),
        openingBalanceDate: a.openingBalanceDate?.toISOString().slice(0, 10) ?? null,
        chartAccount: a.chartAccount,
        currentBalance: balance,
        unreconciledCount: unreconciled,
        lastSyncAt: a.lastSyncedAt?.toISOString() ?? lastImport?.importedAt.toISOString() ?? null,
      };
    }),
  );

  return NextResponse.json({ accounts: out });
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

  const parsed = bankingAccountCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  let openingBalanceDate: Date | null = null;
  if (d.openingBalanceDate?.trim()) {
    openingBalanceDate = parseYmd(d.openingBalanceDate.trim().slice(0, 10));
    if (Number.isNaN(openingBalanceDate.getTime())) openingBalanceDate = null;
  }

  if (d.chartAccountId?.trim()) {
    const ok = await prisma.account.findFirst({
      where: { id: d.chartAccountId.trim(), userId: session.sub, isActive: true },
    });
    if (!ok) return NextResponse.json({ error: "Invalid chart account" }, { status: 400 });
  }

  const created = await prisma.bankingAccount.create({
    data: {
      userId: session.sub,
      bankName: d.bankName.trim(),
      accountName: d.accountName.trim(),
      accountNumber: d.accountNumber.trim(),
      routingOrIfsc: d.routingOrIfsc?.trim() || null,
      currency: d.currency?.trim() || "INR",
      kind: d.kind,
      status: d.status ?? "ACTIVE",
      openingBalance: d.openingBalance ?? 0,
      openingBalanceDate,
      chartAccountId: d.chartAccountId?.trim() || null,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
