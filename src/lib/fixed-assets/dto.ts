import type { FixedAsset, Prisma } from "@prisma/client";

type AssetRow = {
  id: string;
  name: string;
  assetCode: string;
  category: string | null;
  purchaseDate: Date;
  purchaseCost: Prisma.Decimal;
  salvageValue: Prisma.Decimal;
  usefulLifeYears: number;
  depreciationMethod: string;
  wdvAnnualPercent: Prisma.Decimal | null;
  depreciationStartDate: Date;
  scheduleFrequency: string;
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  accumulatedDepreciation: Prisma.Decimal;
  currentBookValue: Prisma.Decimal;
  status: string;
  disposedAt: Date | null;
  disposalType: string | null;
  disposalProceeds: Prisma.Decimal | null;
  disposalGainOrLoss: Prisma.Decimal | null;
  disposalJournalId: string | null;
};

export function fixedAssetToDto(asset: AssetRow | FixedAsset) {
  return {
    id: asset.id,
    name: asset.name,
    assetCode: asset.assetCode,
    category: asset.category,
    purchaseDate: asset.purchaseDate.toISOString(),
    purchaseCost: Number(asset.purchaseCost),
    salvageValue: Number(asset.salvageValue),
    usefulLifeYears: asset.usefulLifeYears,
    depreciationMethod: asset.depreciationMethod,
    wdvAnnualPercent: asset.wdvAnnualPercent != null ? Number(asset.wdvAnnualPercent) : null,
    depreciationStartDate: asset.depreciationStartDate.toISOString(),
    scheduleFrequency: asset.scheduleFrequency,
    assetAccountId: asset.assetAccountId,
    depreciationExpenseAccountId: asset.depreciationExpenseAccountId,
    accumulatedDepreciationAccountId: asset.accumulatedDepreciationAccountId,
    accumulatedDepreciation: Number(asset.accumulatedDepreciation),
    currentBookValue: Number(asset.currentBookValue),
    status: asset.status,
    disposedAt: asset.disposedAt?.toISOString() ?? null,
    disposalType: asset.disposalType,
    disposalProceeds: asset.disposalProceeds != null ? Number(asset.disposalProceeds) : null,
    disposalGainOrLoss: asset.disposalGainOrLoss != null ? Number(asset.disposalGainOrLoss) : null,
    disposalJournalId: asset.disposalJournalId,
  };
}
