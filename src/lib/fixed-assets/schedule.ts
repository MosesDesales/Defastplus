import type { DepreciationMethod, DepreciationScheduleFrequency } from "@prisma/client";
import { computeDepreciationForPeriod } from "@/lib/fixed-assets/amounts";
import { periodBoundsUtc } from "@/lib/fixed-assets/period";
import { round2 } from "@/lib/purchases/line-math";

export type ScheduleRow = {
  periodStart: string;
  periodEnd: string;
  openingValue: number;
  depreciationAmount: number;
  closingValue: number;
  posted: boolean;
  journalEntryId?: string | null;
};

export function advancePeriodStart(periodStart: Date, frequency: DepreciationScheduleFrequency): Date {
  const y = periodStart.getUTCFullYear();
  const m = periodStart.getUTCMonth();
  if (frequency === "MONTHLY") return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  if (frequency === "QUARTERLY") return new Date(Date.UTC(y, m + 3, 1, 0, 0, 0, 0));
  return new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0));
}

export function firstDepreciationPeriodStart(
  depreciationStartDate: Date,
  frequency: DepreciationScheduleFrequency,
): Date {
  return periodBoundsUtc(depreciationStartDate, frequency).periodStart;
}

type PostedRow = {
  periodStart: Date;
  amount: number;
  openingBookValue: number;
  closingBookValue: number;
  journalEntryId: string;
};

export function buildAssetSchedule(
  asset: {
    purchaseCost: number;
    salvageValue: number;
    usefulLifeYears: number;
    depreciationMethod: DepreciationMethod;
    scheduleFrequency: DepreciationScheduleFrequency;
    wdvAnnualPercent: number | null;
    depreciationStartDate: Date;
  },
  posted: PostedRow[],
  includeProjectedPeriods: number,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const sorted = [...posted].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

  for (const hit of sorted) {
    const { periodEnd } = periodBoundsUtc(hit.periodStart, asset.scheduleFrequency);
    rows.push({
      periodStart: hit.periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      openingValue: round2(hit.openingBookValue),
      depreciationAmount: round2(hit.amount),
      closingValue: round2(hit.closingBookValue),
      posted: true,
      journalEntryId: hit.journalEntryId,
    });
  }

  const purchaseCost = round2(asset.purchaseCost);
  const salvage = round2(asset.salvageValue);
  let book =
    sorted.length > 0 ? round2(sorted[sorted.length - 1]!.closingBookValue) : purchaseCost;
  let ps =
    sorted.length > 0
      ? advancePeriodStart(sorted[sorted.length - 1]!.periodStart, asset.scheduleFrequency)
      : firstDepreciationPeriodStart(asset.depreciationStartDate, asset.scheduleFrequency);

  if (sorted.length === 0) {
    const firstEnd = periodBoundsUtc(ps, asset.scheduleFrequency).periodEnd;
    if (asset.depreciationStartDate > firstEnd) {
      return rows;
    }
  }

  let projectedEmitted = 0;
  const safetyCap = 480;

  for (let i = 0; i < safetyCap && projectedEmitted < includeProjectedPeriods; i += 1) {
    const { periodEnd } = periodBoundsUtc(ps, asset.scheduleFrequency);
    if (asset.depreciationStartDate > periodEnd) {
      ps = advancePeriodStart(ps, asset.scheduleFrequency);
      continue;
    }

    const opening = book;
    const amount = computeDepreciationForPeriod({
      method: asset.depreciationMethod,
      purchaseCost,
      salvageValue: salvage,
      usefulLifeYears: asset.usefulLifeYears,
      frequency: asset.scheduleFrequency,
      openingBookValue: opening,
      wdvAnnualPercent: asset.wdvAnnualPercent,
    });

    if (amount <= 0 && opening <= salvage + 0.02) {
      break;
    }

    const closing = round2(Math.max(salvage, opening - amount));
    rows.push({
      periodStart: ps.toISOString(),
      periodEnd: periodEnd.toISOString(),
      openingValue: opening,
      depreciationAmount: amount,
      closingValue: closing,
      posted: false,
      journalEntryId: null,
    });
    projectedEmitted += 1;
    book = closing;
    ps = advancePeriodStart(ps, asset.scheduleFrequency);

    if (book <= salvage + 0.02) {
      break;
    }
  }

  return rows;
}
