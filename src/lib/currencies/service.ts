import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { CURRENCY_TEMPLATES } from "@/lib/currencies/defaults";

/** Seed starter currencies once per workspace. */
export async function ensureDefaultCurrencies(prisma: PrismaClient, userId: string): Promise<void> {
  const n = await prisma.currency.count({ where: { userId } });
  if (n > 0) return;

  const profile = await prisma.companyProfile.findUnique({ where: { userId } });
  const preferredBase = (profile?.currency ?? "INR").trim().toUpperCase() || "INR";
  const baseCode = CURRENCY_TEMPLATES.some((t) => t.code === preferredBase) ? preferredBase : "INR";

  for (const t of CURRENCY_TEMPLATES) {
    const isBase = t.code === baseCode;
    await prisma.currency.create({
      data: {
        userId,
        code: t.code,
        symbol: t.symbol,
        name: t.name,
        decimalPlaces: t.decimalPlaces,
        formatLocale: t.formatLocale,
        isBaseCurrency: isBase,
        exchangeRate: isBase ? null : null,
        isActive: true,
      },
    });
  }
}

/** Keep a single base row aligned with CompanyProfile.currency. */
export async function alignCurrencyBaseWithCompanyProfile(prisma: PrismaClient, userId: string): Promise<void> {
  await ensureDefaultCurrencies(prisma, userId);
  const profile = await prisma.companyProfile.findUnique({ where: { userId } });
  const code = (profile?.currency ?? "INR").trim().toUpperCase() || "INR";

  const row = await prisma.currency.findUnique({ where: { userId_code: { userId, code } } });
  if (!row) return;

  await prisma.$transaction([
    prisma.currency.updateMany({ where: { userId }, data: { isBaseCurrency: false } }),
    prisma.currency.update({
      where: { id: row.id },
      data: {
        isBaseCurrency: true,
        exchangeRate: null,
      },
    }),
  ]);
}

/** Fetch live rates: open.er-api.com (no key). `rates[sym]` = sym per 1 base; multiplier to base = 1/rates[sym]. */
export async function fetchLiveRatesToBase(baseCode: string): Promise<{
  rates: Record<string, number>;
  error?: string;
}> {
  const base = baseCode.trim().toUpperCase();
  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { rates: {}, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
      return { rates: {}, error: "Invalid FX response" };
    }
    const out: Record<string, number> = {};
    for (const [sym, v] of Object.entries(data.rates)) {
      const code = sym.toUpperCase();
      if (code === base) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
      const multToBase = 1 / v;
      if (Number.isFinite(multToBase) && multToBase > 0) {
        out[code] = multToBase;
      }
    }
    return { rates: out };
  } catch (e) {
    return { rates: {}, error: e instanceof Error ? e.message : "Fetch failed" };
  }
}

export async function applyLiveRates(
  prisma: PrismaClient,
  userId: string,
  baseCode: string,
): Promise<{ updated: number; skipped: string[]; error?: string }> {
  const { rates, error } = await fetchLiveRatesToBase(baseCode);
  if (error && Object.keys(rates).length === 0) {
    return { updated: 0, skipped: [], error };
  }
  const rows = await prisma.currency.findMany({ where: { userId, isActive: true } });
  const now = new Date();
  let updated = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    if (r.isBaseCurrency) continue;
    const m = rates[r.code];
    if (m == null) {
      skipped.push(r.code);
      continue;
    }
    await prisma.currency.update({
      where: { id: r.id },
      data: {
        exchangeRate: new Prisma.Decimal(m.toFixed(8)),
        rateUpdatedAt: now,
      },
    });
    updated += 1;
  }
  return { updated, skipped, error };
}
