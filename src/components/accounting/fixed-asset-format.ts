const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatInr(n: number) {
  return inr.format(Number.isFinite(n) ? n : 0);
}

export function ymdFromIso(iso: string) {
  return iso.slice(0, 10);
}
