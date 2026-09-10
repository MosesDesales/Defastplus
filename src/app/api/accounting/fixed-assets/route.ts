import { DepreciationScheduleFrequency, FixedAssetStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { requireApiModules } from "@/lib/api-require-module";
import { fixedAssetToDto } from "@/lib/fixed-assets/dto";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fixedAssetCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  await ensureDefaultAccounts(prisma, session.sub);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toUpperCase();
  const statusFilter =
    status && (Object.keys(FixedAssetStatus) as string[]).includes(status)
      ? (status as FixedAssetStatus)
      : undefined;

  const rows = await prisma.fixedAsset.findMany({
    where: {
      userId: session.sub,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ status: "asc" }, { assetCode: "asc" }],
  });

  return NextResponse.json({ assets: rows.map(fixedAssetToDto) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  await ensureDefaultAccounts(prisma, session.sub);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fixedAssetCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const purchaseDate = parseYmd(d.purchaseDate);
  const depStart = parseYmd(d.depreciationStartDate);
  if (Number.isNaN(purchaseDate.getTime()) || Number.isNaN(depStart.getTime())) {
    return NextResponse.json({ error: "Invalid date format (use YYYY-MM-DD)" }, { status: 400 });
  }

  const accountIds = [d.assetAccountId, d.depreciationExpenseAccountId, d.accumulatedDepreciationAccountId];
  if (new Set(accountIds).size !== 3) {
    return NextResponse.json(
      {
        error:
          "Choose three different GL accounts: fixed asset (at cost), depreciation expense, and accumulated depreciation.",
      },
      { status: 400 },
    );
  }
  const acctCount = await prisma.account.count({
    where: { userId: session.sub, id: { in: accountIds } },
  });
  if (acctCount !== 3) return NextResponse.json({ error: "One or more GL accounts are invalid." }, { status: 400 });

  const freq = (d.scheduleFrequency ?? "MONTHLY") as DepreciationScheduleFrequency;

  try {
    const asset = await prisma.fixedAsset.create({
      data: {
        userId: session.sub,
        name: d.name.trim(),
        assetCode: d.assetCode.trim().toUpperCase(),
        category: d.category?.trim() || null,
        purchaseDate,
        purchaseCost: new Prisma.Decimal(d.purchaseCost),
        salvageValue: new Prisma.Decimal(d.salvageValue),
        usefulLifeYears: d.usefulLifeYears,
        depreciationMethod: d.depreciationMethod,
        wdvAnnualPercent:
          d.depreciationMethod === "WRITTEN_DOWN_VALUE" && d.wdvAnnualPercent != null
            ? new Prisma.Decimal(d.wdvAnnualPercent)
            : null,
        depreciationStartDate: depStart,
        scheduleFrequency: freq,
        assetAccountId: d.assetAccountId,
        depreciationExpenseAccountId: d.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: d.accumulatedDepreciationAccountId,
        accumulatedDepreciation: new Prisma.Decimal(0),
        currentBookValue: new Prisma.Decimal(d.purchaseCost),
        status: FixedAssetStatus.ACTIVE,
      },
    });
    return NextResponse.json({ asset: fixedAssetToDto(asset) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Asset code must be unique in your workspace." }, { status: 409 });
    }
    console.error("POST /api/accounting/fixed-assets", e);
    const msg = e instanceof Error ? e.message : "Could not save the asset.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
