const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Whole number in the Indian numbering system (thousand, lakh, crore). */
export function integerToIndianWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  if (crore) parts.push(`${integerToIndianWords(crore)} Crore`);
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

const CURRENCY_WORDS: Record<string, [major: string, minor: string]> = {
  INR: ["Indian Rupees", "Paise"],
  USD: ["US Dollars", "Cents"],
  EUR: ["Euros", "Cents"],
  GBP: ["Pounds Sterling", "Pence"],
  AED: ["UAE Dirhams", "Fils"],
};

/** e.g. 149900.5 → "Indian Rupees One Lakh Forty-Nine Thousand Nine Hundred and Fifty Paise Only" */
export function amountInWords(amount: number, currency = "INR"): string {
  const [major, minor] = CURRENCY_WORDS[currency.toUpperCase()] ?? [currency.toUpperCase(), "Cents"];
  const negative = amount < 0;
  const paiseTotal = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(paiseTotal / 100);
  const fraction = paiseTotal % 100;
  let words = `${major} ${integerToIndianWords(whole)}`;
  if (fraction) words += ` and ${belowHundred(fraction)} ${minor}`;
  return `${negative ? "Minus " : ""}${words} Only`;
}
