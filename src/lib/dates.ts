/** Parse `YYYY-MM-DD` as local noon to reduce timezone drift in SQLite. */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Adds NET_* days to bill date; due on receipt uses same day. */
export function dueDateFromPaymentTerms(billDate: Date, paymentTerms: string): Date {
  const map: Record<string, number> = {
    DUE_ON_RECEIPT: 0,
    NET_15: 15,
    NET_30: 30,
    NET_45: 45,
    NET_60: 60,
  };
  const days = map[paymentTerms] ?? 0;
  const d = new Date(billDate.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
