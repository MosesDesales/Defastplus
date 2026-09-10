import { DepreciationMethod, DepreciationScheduleFrequency } from "@prisma/client";
import { round2 } from "@/lib/purchases/line-math";

export function slmPeriodAmount(
  depreciableBase: number,
  usefulLifeYears: number,
  frequency: DepreciationScheduleFrequency,
): number {
  if (usefulLifeYears <= 0) return 0;
  const periods =
    frequency === DepreciationScheduleFrequency.MONTHLY
      ? usefulLifeYears * 12
      : frequency === DepreciationScheduleFrequency.QUARTERLY
        ? usefulLifeYears * 4
        : usefulLifeYears;
  if (periods <= 0) return 0;
  return round2(depreciableBase / periods);
}

/** WDV: opening book × annual % scaled to period (capped so book does not go below salvage). */
export function wdvPeriodAmount(
  openingBook: number,
  salvage: number,
  annualPercent: number,
  frequency: DepreciationScheduleFrequency,
): number {
  if (openingBook <= salvage + 0.005) return 0;
  let fraction = annualPercent / 100;
  if (frequency === DepreciationScheduleFrequency.MONTHLY) fraction /= 12;
  else if (frequency === DepreciationScheduleFrequency.QUARTERLY) fraction /= 4;
  const raw = round2(openingBook * fraction);
  const cap = round2(Math.max(0, openingBook - salvage));
  return round2(Math.min(raw, cap));
}

export function computeDepreciationForPeriod(input: {
  method: DepreciationMethod;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  frequency: DepreciationScheduleFrequency;
  openingBookValue: number;
  wdvAnnualPercent: number | null;
}): number {
  const salvage = round2(input.salvageValue);
  const cost = round2(input.purchaseCost);
  const depreciable = round2(Math.max(0, cost - salvage));
  if (depreciable <= 0) return 0;
  if (input.openingBookValue <= salvage + 0.005) return 0;

  if (input.method === DepreciationMethod.STRAIGHT_LINE) {
    const raw = slmPeriodAmount(depreciable, input.usefulLifeYears, input.frequency);
    const cap = round2(Math.max(0, input.openingBookValue - salvage));
    return round2(Math.min(raw, cap));
  }

  const pct = input.wdvAnnualPercent ?? 0;
  if (pct <= 0) return 0;
  return wdvPeriodAmount(input.openingBookValue, salvage, pct, input.frequency);
}
