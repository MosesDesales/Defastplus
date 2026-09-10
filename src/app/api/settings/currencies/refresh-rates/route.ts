import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { applyLiveRates, ensureDefaultCurrencies } from "@/lib/currencies/service";
import { prisma } from "@/lib/prisma";

/** POST: refresh FX from exchangerate.host into non-base rows. */
export async function POST() {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  await ensureDefaultCurrencies(prisma, session.sub);
  const base = await prisma.currency.findFirst({
    where: { userId: session.sub, isBaseCurrency: true },
  });
  if (!base) {
    return NextResponse.json({ error: "No base currency configured." }, { status: 400 });
  }

  const { updated, skipped, error } = await applyLiveRates(prisma, session.sub, base.code);
  return NextResponse.json({ ok: true, updated, skipped, warning: error });
}
