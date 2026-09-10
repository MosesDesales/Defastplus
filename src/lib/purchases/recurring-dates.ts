import type { RecurringFrequency } from "@prisma/client";

/** Advance schedule anchor `from` by one period × `repeatEvery` (minimum 1). */
export function advanceRecurringDate(from: Date, frequency: RecurringFrequency, repeatEvery = 1): Date {
  const d = new Date(from);
  const n = Math.max(1, Math.floor(repeatEvery));
  if (frequency === "DAILY") {
    d.setDate(d.getDate() + n);
  } else if (frequency === "WEEKLY") {
    d.setDate(d.getDate() + 7 * n);
  } else if (frequency === "YEARLY") {
    d.setFullYear(d.getFullYear() + n);
  } else {
    d.setMonth(d.getMonth() + n);
  }
  return d;
}
