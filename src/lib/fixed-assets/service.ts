import type { PrismaClient } from "@prisma/client";
import {
  FixedAssetStatus,
  JournalPostingStatus,
  JournalReferenceKind,
  Prisma,
} from "@prisma/client";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { computeDepreciationForPeriod } from "@/lib/fixed-assets/amounts";
import { periodBoundsUtc } from "@/lib/fixed-assets/period";
import { round2 } from "@/lib/purchases/line-math";

const dec0 = () => new Prisma.Decimal(0);

export type RunDepreciationResult = {
  posted: number;
  skipped: number;
  wouldPost: number;
  errors: string[];
};

export async function runDepreciation(
  prisma: PrismaClient,
  userId: string,
  options: { asOf: Date; assetId?: string; dryRun?: boolean },
): Promise<RunDepreciationResult> {
  await ensureDefaultAccounts(prisma, userId);
  const asOf = options.asOf;
  const dryRun = Boolean(options.dryRun);

  const assets = await prisma.fixedAsset.findMany({
    where: {
      userId,
      status: FixedAssetStatus.ACTIVE,
      ...(options.assetId ? { id: options.assetId } : {}),
    },
  });

  let posted = 0;
  let skipped = 0;
  let wouldPost = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    const { periodStart, periodEnd } = periodBoundsUtc(asOf, asset.scheduleFrequency);
    if (asset.depreciationStartDate > periodEnd) {
      skipped += 1;
      continue;
    }

    const exists = await prisma.depreciationEntry.findUnique({
      where: { assetId_periodStart: { assetId: asset.id, periodStart } },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const purchaseCost = Number(asset.purchaseCost);
    const salvage = Number(asset.salvageValue);
    const opening = Number(asset.currentBookValue);
    const accum = Number(asset.accumulatedDepreciation);
    const wdv = asset.wdvAnnualPercent != null ? Number(asset.wdvAnnualPercent) : null;

    const amount = computeDepreciationForPeriod({
      method: asset.depreciationMethod,
      purchaseCost,
      salvageValue: salvage,
      usefulLifeYears: asset.usefulLifeYears,
      frequency: asset.scheduleFrequency,
      openingBookValue: opening,
      wdvAnnualPercent: wdv,
    });

    if (amount <= 0) {
      skipped += 1;
      const atSalvage = round2(purchaseCost - accum) <= salvage + 0.02;
      if (atSalvage && !dryRun) {
        await prisma.fixedAsset.update({
          where: { id: asset.id },
          data: {
            status: FixedAssetStatus.FULLY_DEPRECIATED,
            currentBookValue: new Prisma.Decimal(salvage),
          },
        });
      }
      continue;
    }

    if (dryRun) {
      wouldPost += 1;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const closing = round2(opening - amount);
        const newAccum = round2(accum + amount);
        const refNo = `DEP-${asset.assetCode}-${periodStart.toISOString().slice(0, 10)}`;

        const je = await tx.journalEntry.create({
          data: {
            userId,
            entryDate: asOf,
            memo: `Depreciation — ${asset.name} (${asset.assetCode})`,
            postingStatus: JournalPostingStatus.POSTED,
            referenceKind: JournalReferenceKind.FIXED_ASSET_DEPRECIATION,
            referenceId: asset.id,
            referenceNo: refNo,
            lines: {
              create: [
                {
                  accountId: asset.depreciationExpenseAccountId,
                  debit: new Prisma.Decimal(amount),
                  credit: dec0(),
                  description: "Depreciation expense",
                },
                {
                  accountId: asset.accumulatedDepreciationAccountId,
                  debit: dec0(),
                  credit: new Prisma.Decimal(amount),
                  description: "Accumulated depreciation",
                },
              ],
            },
          },
        });

        await tx.depreciationEntry.create({
          data: {
            assetId: asset.id,
            periodStart,
            amount: new Prisma.Decimal(amount),
            openingBookValue: new Prisma.Decimal(opening),
            closingBookValue: new Prisma.Decimal(closing),
            journalEntryId: je.id,
          },
        });

        const newBook = Math.max(salvage, closing);
        const newStatus =
          newBook <= salvage + 0.02 ? FixedAssetStatus.FULLY_DEPRECIATED : FixedAssetStatus.ACTIVE;

        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: new Prisma.Decimal(newAccum),
            currentBookValue: new Prisma.Decimal(newBook),
            status: newStatus,
          },
        });
      });
      posted += 1;
    } catch (e) {
      errors.push(`${asset.assetCode}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { posted, skipped, wouldPost, errors };
}

export async function disposeFixedAsset(
  prisma: PrismaClient,
  userId: string,
  assetId: string,
  input: { type: "SELL" | "SCRAP"; proceeds: number; cashAccountId?: string | null },
): Promise<{ journalId: string } | { error: string }> {
  await ensureDefaultAccounts(prisma, userId);

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: assetId, userId, status: { in: [FixedAssetStatus.ACTIVE, FixedAssetStatus.FULLY_DEPRECIATED] } },
  });
  if (!asset) return { error: "Asset not found or already disposed." };

  const proceeds = round2(Math.max(0, input.proceeds));
  if (input.type === "SELL" && proceeds > 0 && !input.cashAccountId) {
    return { error: "Cash / bank account is required when proceeds are greater than zero." };
  }

  const cost = Number(asset.purchaseCost);
  const accum = Number(asset.accumulatedDepreciation);
  const gain = round2(proceeds + accum - cost);

  const gainAcct = await prisma.account.findFirst({ where: { userId, code: "4135" } });
  const lossAcct = await prisma.account.findFirst({ where: { userId, code: "5185" } });
  if (!gainAcct || !lossAcct) return { error: "Missing gain (4135) or loss (5185) accounts — run chart sync." };

  const lines: Array<{
    accountId: string;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    description: string;
  }> = [];

  if (proceeds > 0 && input.cashAccountId) {
    lines.push({
      accountId: input.cashAccountId,
      debit: new Prisma.Decimal(proceeds),
      credit: dec0(),
      description: "Proceeds on disposal",
    });
  }

  lines.push({
    accountId: asset.accumulatedDepreciationAccountId,
    debit: new Prisma.Decimal(accum),
    credit: dec0(),
    description: "Clear accumulated depreciation",
  });

  lines.push({
    accountId: asset.assetAccountId,
    debit: dec0(),
    credit: new Prisma.Decimal(cost),
    description: "Remove asset at cost",
  });

  if (gain >= 0.01) {
    lines.push({
      accountId: gainAcct.id,
      debit: dec0(),
      credit: new Prisma.Decimal(gain),
      description: "Gain on disposal",
    });
  } else if (gain <= -0.01) {
    lines.push({
      accountId: lossAcct.id,
      debit: new Prisma.Decimal(-gain),
      credit: dec0(),
      description: "Loss on disposal",
    });
  }

  const td = lines.reduce((s, l) => s + Number(l.debit), 0);
  const tc = lines.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(td - tc) > 0.02) {
    return { error: `Disposal journal out of balance (${td} vs ${tc}).` };
  }

  const refNo = `DISP-${asset.assetCode}-${new Date().toISOString().slice(0, 10)}`;

  const result = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        userId,
        entryDate: new Date(),
        memo: `Disposal (${input.type}) — ${asset.name} (${asset.assetCode})`,
        postingStatus: JournalPostingStatus.POSTED,
        referenceKind: JournalReferenceKind.FIXED_ASSET_DISPOSAL,
        referenceId: asset.id,
        referenceNo: refNo,
        lines: { create: lines },
      },
    });

    await tx.fixedAsset.update({
      where: { id: asset.id },
      data: {
        status: FixedAssetStatus.DISPOSED,
        disposedAt: new Date(),
        disposalType: input.type,
        disposalProceeds: new Prisma.Decimal(proceeds),
        disposalGainOrLoss: new Prisma.Decimal(gain),
        disposalCashAccountId: input.cashAccountId ?? null,
        disposalJournalId: je.id,
        currentBookValue: dec0(),
      },
    });

    return je.id;
  });

  return { journalId: result };
}
