import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { bankingAccountPatchSchema } from "@/lib/validators";
import { parseYmd } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.bankingAccount.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bankingAccountPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  if (p.chartAccountId !== undefined && p.chartAccountId?.trim()) {
    const ok = await prisma.account.findFirst({
      where: { id: p.chartAccountId.trim(), userId: session.sub, isActive: true },
    });
    if (!ok) return NextResponse.json({ error: "Invalid chart account" }, { status: 400 });
  }

  let openingBalanceDate: Date | undefined;
  if (p.openingBalanceDate !== undefined) {
    if (!p.openingBalanceDate?.trim()) openingBalanceDate = undefined;
    else {
      const d = parseYmd(p.openingBalanceDate.trim().slice(0, 10));
      openingBalanceDate = Number.isNaN(d.getTime()) ? undefined : d;
    }
  }

  await prisma.bankingAccount.update({
    where: { id },
    data: {
      ...(p.bankName !== undefined ? { bankName: p.bankName.trim() } : {}),
      ...(p.accountName !== undefined ? { accountName: p.accountName.trim() } : {}),
      ...(p.accountNumber !== undefined ? { accountNumber: p.accountNumber.trim() } : {}),
      ...(p.routingOrIfsc !== undefined ? { routingOrIfsc: p.routingOrIfsc?.trim() || null } : {}),
      ...(p.currency !== undefined ? { currency: p.currency.trim() } : {}),
      ...(p.kind !== undefined ? { kind: p.kind } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.openingBalance !== undefined ? { openingBalance: p.openingBalance } : {}),
      ...(p.openingBalanceDate !== undefined ? { openingBalanceDate: openingBalanceDate ?? null } : {}),
      ...(p.chartAccountId !== undefined ? { chartAccountId: p.chartAccountId?.trim() || null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.bankingAccount.findFirst({ where: { id, userId: session.sub } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bankingAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
