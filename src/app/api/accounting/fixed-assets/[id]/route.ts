import { FixedAssetStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { requireApiModules } from "@/lib/api-require-module";
import { fixedAssetToDto } from "@/lib/fixed-assets/dto";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/purchases/line-math";
import { getSession } from "@/lib/session";
import { fixedAssetPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  const { id } = await ctx.params;
  const asset = await prisma.fixedAsset.findFirst({ where: { id, userId: session.sub } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.depreciationEntry.findMany({
    where: { assetId: id },
    orderBy: { periodStart: "asc" },
    include: { journalEntry: { select: { id: true, referenceNo: true, entryDate: true } } },
  });

  return NextResponse.json({
    asset: fixedAssetToDto(asset),
    depreciationEntries: entries.map((e) => ({
      id: e.id,
      periodStart: e.periodStart.toISOString(),
      amount: Number(e.amount),
      openingBookValue: Number(e.openingBookValue),
      closingBookValue: Number(e.closingBookValue),
      journalEntryId: e.journalEntryId,
      journalReferenceNo: e.journalEntry.referenceNo,
      journalEntryDate: e.journalEntry.entryDate.toISOString(),
    })),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.fixedAsset.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === FixedAssetStatus.DISPOSED) {
    return NextResponse.json({ error: "Disposed assets cannot be edited." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fixedAssetPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const nextCost = d.purchaseCost ?? Number(existing.purchaseCost);
  const nextSalvage = d.salvageValue ?? Number(existing.salvageValue);
  if (nextSalvage >= nextCost) {
    return NextResponse.json({ error: "Salvage value must be less than purchase cost." }, { status: 400 });
  }

  const nextMethod = d.depreciationMethod ?? existing.depreciationMethod;
  const nextWdv =
    d.wdvAnnualPercent !== undefined && d.wdvAnnualPercent != null
      ? Number(d.wdvAnnualPercent)
      : existing.wdvAnnualPercent != null
        ? Number(existing.wdvAnnualPercent)
        : null;
  if (nextMethod === "WRITTEN_DOWN_VALUE" && (nextWdv == null || nextWdv <= 0)) {
    return NextResponse.json(
      { error: "Written down value method requires a positive annual depreciation percent." },
      { status: 400 },
    );
  }

  await ensureDefaultAccounts(prisma, session.sub);

  const data: Prisma.FixedAssetUpdateInput = {};
  if (d.name != null) data.name = d.name.trim();
  if (d.assetCode != null) data.assetCode = d.assetCode.trim().toUpperCase();
  if (d.category !== undefined) data.category = d.category?.trim() || null;
  if (d.purchaseDate != null) {
    const dt = parseYmd(d.purchaseDate);
    if (Number.isNaN(dt.getTime())) return NextResponse.json({ error: "Invalid purchase date" }, { status: 400 });
    data.purchaseDate = dt;
  }
  if (d.purchaseCost != null) data.purchaseCost = new Prisma.Decimal(d.purchaseCost);
  if (d.salvageValue != null) data.salvageValue = new Prisma.Decimal(d.salvageValue);
  if (d.usefulLifeYears != null) data.usefulLifeYears = d.usefulLifeYears;
  if (d.depreciationMethod != null) data.depreciationMethod = d.depreciationMethod;
  if (d.wdvAnnualPercent !== undefined) {
    data.wdvAnnualPercent =
      d.wdvAnnualPercent != null ? new Prisma.Decimal(d.wdvAnnualPercent) : null;
  }
  if (d.depreciationStartDate != null) {
    const dt = parseYmd(d.depreciationStartDate);
    if (Number.isNaN(dt.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    data.depreciationStartDate = dt;
  }
  if (d.scheduleFrequency != null) data.scheduleFrequency = d.scheduleFrequency;
  if (d.assetAccountId != null) data.assetAccount = { connect: { id: d.assetAccountId } };
  if (d.depreciationExpenseAccountId != null) {
    data.depreciationExpenseAccount = { connect: { id: d.depreciationExpenseAccountId } };
  }
  if (d.accumulatedDepreciationAccountId != null) {
    data.accumulatedDepreciationAccount = { connect: { id: d.accumulatedDepreciationAccountId } };
  }

  const mergedAssetId = d.assetAccountId ?? existing.assetAccountId;
  const mergedExpenseId = d.depreciationExpenseAccountId ?? existing.depreciationExpenseAccountId;
  const mergedAccumId = d.accumulatedDepreciationAccountId ?? existing.accumulatedDepreciationAccountId;
  if (new Set([mergedAssetId, mergedExpenseId, mergedAccumId]).size !== 3) {
    return NextResponse.json(
      {
        error:
          "Fixed asset (cost), depreciation expense, and accumulated depreciation must be three different GL accounts.",
      },
      { status: 400 },
    );
  }
  const mergedIds = [mergedAssetId, mergedExpenseId, mergedAccumId];
  const acctCount = await prisma.account.count({
    where: { userId: session.sub, id: { in: mergedIds } },
  });
  if (acctCount !== 3) {
    return NextResponse.json({ error: "One or more GL accounts are invalid." }, { status: 400 });
  }

  try {
    await prisma.fixedAsset.update({ where: { id }, data });
    const row = await prisma.fixedAsset.findFirst({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cost = Number(row.purchaseCost);
    const accum = Number(row.accumulatedDepreciation);
    const salv = Number(row.salvageValue);
    const book = Math.max(salv, round2(cost - accum));
    const updated = await prisma.fixedAsset.update({
      where: { id },
      data: { currentBookValue: new Prisma.Decimal(book) },
    });
    return NextResponse.json({ asset: fixedAssetToDto(updated) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Asset code must be unique." }, { status: 409 });
    }
    console.error("PATCH /api/accounting/fixed-assets/[id]", e);
    const msg = e instanceof Error ? e.message : "Could not update the asset.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
