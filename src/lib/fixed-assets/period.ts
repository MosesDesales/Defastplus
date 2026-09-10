import { DepreciationScheduleFrequency } from "@prisma/client";

/** UTC calendar bounds for the period containing `asOf`. */
export function periodBoundsUtc(
  asOf: Date,
  frequency: DepreciationScheduleFrequency,
): { periodStart: Date; periodEnd: Date } {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  if (frequency === DepreciationScheduleFrequency.MONTHLY) {
    const periodStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    return { periodStart, periodEnd };
  }
  if (frequency === DepreciationScheduleFrequency.QUARTERLY) {
    const q = Math.floor(m / 3);
    const sm = q * 3;
    const periodStart = new Date(Date.UTC(y, sm, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(y, sm + 3, 0, 23, 59, 59, 999));
    return { periodStart, periodEnd };
  }
  const periodStart = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
