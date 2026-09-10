import type { Currency } from "@prisma/client";
import { formatCurrencyPreview } from "@/lib/currencies/format-preview";

export function currencyToDto(c: Currency) {
  const rate = c.exchangeRate != null ? Number(c.exchangeRate) : null;
  return {
    id: c.id,
    code: c.code,
    symbol: c.symbol,
    name: c.name,
    decimalPlaces: c.decimalPlaces,
    formatLocale: c.formatLocale,
    formatPreview: formatCurrencyPreview(c.code, c.formatLocale, c.decimalPlaces),
    isBaseCurrency: c.isBaseCurrency,
    exchangeRate: rate,
    rateUpdatedAt: c.rateUpdatedAt?.toISOString() ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export type CurrencyDto = ReturnType<typeof currencyToDto>;
