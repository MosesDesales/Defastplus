/** Sample amount for “Format” column previews. */
const SAMPLE = 100000.5;

export function formatCurrencyPreview(code: string, formatLocale: string, decimalPlaces: number): string {
  try {
    return new Intl.NumberFormat(formatLocale || "en-IN", {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(SAMPLE);
  } catch {
    return `${code} ${SAMPLE.toFixed(decimalPlaces)}`;
  }
}
