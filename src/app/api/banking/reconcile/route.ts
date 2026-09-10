import { BankingMappingModuleType } from "@prisma/client";
import { NextResponse } from "next/server";
import { applyBankingMatches } from "@/lib/banking/reconcile";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { bankingReconcileSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bankingReconcileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const matches = parsed.data.matches.map((m) => ({
    moduleType: m.moduleType as BankingMappingModuleType,
    moduleId: m.moduleId,
    amount: m.amount,
    expenseAccountId: m.expenseAccountId,
  }));

  try {
    const out = await applyBankingMatches(prisma, session.sub, parsed.data.bankingTransactionId, matches);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reconcile failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
