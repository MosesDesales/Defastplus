export type CurrencyTemplate = {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  formatLocale: string;
};

/** Preloaded workspace currencies (Zoho-style starter set). */
export const CURRENCY_TEMPLATES: CurrencyTemplate[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimalPlaces: 2, formatLocale: "en-IN" },
  { code: "USD", symbol: "$", name: "United States Dollar", decimalPlaces: 2, formatLocale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", decimalPlaces: 2, formatLocale: "de-DE" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimalPlaces: 2, formatLocale: "en-AE" },
  { code: "GBP", symbol: "£", name: "Pound Sterling", decimalPlaces: 2, formatLocale: "en-GB" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimalPlaces: 2, formatLocale: "en-AU" },
  { code: "SAR", symbol: "SR", name: "Saudi Riyal", decimalPlaces: 2, formatLocale: "ar-SA" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimalPlaces: 0, formatLocale: "ja-JP" },
];

/** ISO codes for create-modal search (includes templates + common extras). */
export const CURRENCY_CODE_OPTIONS: { code: string; name: string }[] = [
  ...CURRENCY_TEMPLATES.map((t) => ({ code: t.code, name: t.name })),
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "ZAR", name: "South African Rand" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
];

export function templateForCode(code: string): CurrencyTemplate | undefined {
  const c = code.trim().toUpperCase();
  return CURRENCY_TEMPLATES.find((t) => t.code === c);
}
