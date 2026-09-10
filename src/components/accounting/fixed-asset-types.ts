export type FixedAssetStatus = "ACTIVE" | "FULLY_DEPRECIATED" | "DISPOSED";

export type FixedAssetDto = {
  id: string;
  name: string;
  assetCode: string;
  category: string | null;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: "STRAIGHT_LINE" | "WRITTEN_DOWN_VALUE";
  wdvAnnualPercent: number | null;
  depreciationStartDate: string;
  scheduleFrequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  accumulatedDepreciation: number;
  currentBookValue: number;
  status: FixedAssetStatus;
  disposedAt: string | null;
  disposalType: string | null;
  disposalProceeds: number | null;
  disposalGainOrLoss: number | null;
  disposalJournalId: string | null;
};

export type DepreciationEntryRow = {
  id: string;
  periodStart: string;
  amount: number;
  openingBookValue: number;
  closingBookValue: number;
  journalEntryId: string;
  journalReferenceNo: string | null;
  journalEntryDate: string;
};

export type ScheduleApiRow = {
  periodStart: string;
  periodEnd: string;
  openingValue: number;
  depreciationAmount: number;
  closingValue: number;
  posted: boolean;
  journalEntryId?: string | null;
};
