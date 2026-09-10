import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const statusFilter =
    status && status !== "all" && ["UNMAPPED", "PARTIALLY_MAPPED", "RECONCILED"].includes(status)
      ? (status as "UNMAPPED" | "PARTIALLY_MAPPED" | "RECONCILED")
      : undefined;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const acct = await prisma.bankingAccount.findFirst({
    where: { id: accountId, userId: session.sub },
  });
  if (!acct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.bankingTransaction.findMany({
    where: {
      bankingAccountId: accountId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ txnDate: "desc" }, { id: "desc" }],
    take: 500,
    include: {
      mappings: { select: { id: true, moduleType: true, moduleId: true, amountApplied: true } },
    },
  });

  return NextResponse.json({
    transactions: rows.map((t) => ({
      id: t.id,
      txnDate: t.txnDate.toISOString(),
      description: t.description,
      reference: t.reference,
      debit: Number(t.debit),
      credit: Number(t.credit),
      balance: t.balance != null ? Number(t.balance) : null,
      status: t.status,
      mappings: t.mappings.map((m) => ({
        id: m.id,
        moduleType: m.moduleType,
        moduleId: m.moduleId,
        amountApplied: Number(m.amountApplied),
      })),
    })),
  });
}
