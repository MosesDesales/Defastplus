import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Organization base currency from company profile (falls back to INR). */
export async function getOrganizationBaseCurrency(db: Db, userId: string): Promise<string> {
  const profile = await db.companyProfile.findUnique({
    where: { userId },
    select: { currency: true },
  });
  return (profile?.currency ?? "INR").trim().toUpperCase() || "INR";
}

/** Resolve FX rate: 1 unit of `currencyCode` → `baseCurrency`. Returns null when same currency. */
export async function resolveExchangeRateToBase(
  db: Db,
  userId: string,
  currencyCode: string,
  baseCurrency: string,
  overrideRate?: number | null,
): Promise<number | null> {
  const code = currencyCode.trim().toUpperCase();
  const base = baseCurrency.trim().toUpperCase();
  if (!code || code === base) return null;

  if (overrideRate != null && Number.isFinite(overrideRate) && overrideRate > 0) {
    return round8(overrideRate);
  }

  const row = await db.currency.findUnique({
    where: { userId_code: { userId, code } },
    select: { exchangeRate: true, isBaseCurrency: true },
  });
  if (row?.isBaseCurrency) return null;
  if (row?.exchangeRate != null) {
    const n = Number(row.exchangeRate);
    if (Number.isFinite(n) && n > 0) return round8(n);
  }
  return null;
}

export type ResolvedDocumentCurrency = {
  currency: string;
  baseCurrency: string;
  exchangeRate: number | null;
  exchangeRateDecimal: Prisma.Decimal | null;
  baseTotalDecimal: (foreignTotal: number) => Prisma.Decimal | null;
};

/** Normalize currency + FX snapshot for invoices, bills, and purchase orders. */
export async function resolveDocumentCurrencyForSave(
  db: Db,
  userId: string,
  input: {
    currency?: string | null;
    exchangeRate?: number | null;
    partyDefaultCurrency?: string | null;
  },
): Promise<ResolvedDocumentCurrency> {
  const baseCurrency = await getOrganizationBaseCurrency(db, userId);
  const currency = (input.currency?.trim() || input.partyDefaultCurrency?.trim() || baseCurrency).toUpperCase();
  const exchangeRate = await resolveExchangeRateToBase(db, userId, currency, baseCurrency, input.exchangeRate);

  return {
    currency,
    baseCurrency,
    exchangeRate,
    exchangeRateDecimal: exchangeRate != null ? new Prisma.Decimal(exchangeRate.toFixed(8)) : null,
    baseTotalDecimal(foreignTotal: number) {
      if (!Number.isFinite(foreignTotal)) return null;
      if (exchangeRate == null) return new Prisma.Decimal(round2(foreignTotal));
      return new Prisma.Decimal(round2(foreignTotal * exchangeRate));
    },
  };
}

export function formatForeignAndBase(
  foreignAmount: number,
  currency: string,
  baseAmount: number | null | undefined,
  baseCurrency: string,
): string {
  const f = `${currency} ${foreignAmount.toFixed(2)}`;
  if (baseAmount == null || currency === baseCurrency) return f;
  return `${f} (≈ ${baseCurrency} ${baseAmount.toFixed(2)})`;
}
