import { NextResponse } from "next/server";
import { buildAssetSchedule } from "@/lib/fixed-assets/schedule";
import { requireApiModules } from "@/lib/api-require-module";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId")?.trim();
  if (!assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  const projected = Math.min(120, Math.max(0, parseInt(searchParams.get("projected") ?? "24", 10) || 24));

  const asset = await prisma.fixedAsset.findFirst({ where: { id: assetId, userId: session.sub } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const posted = await prisma.depreciationEntry.findMany({
    where: { assetId },
    orderBy: { periodStart: "asc" },
  });

  const schedule = buildAssetSchedule(
    {
      purchaseCost: Number(asset.purchaseCost),
      salvageValue: Number(asset.salvageValue),
      usefulLifeYears: asset.usefulLifeYears,
      depreciationMethod: asset.depreciationMethod,
      scheduleFrequency: asset.scheduleFrequency,
      wdvAnnualPercent: asset.wdvAnnualPercent != null ? Number(asset.wdvAnnualPercent) : null,
      depreciationStartDate: asset.depreciationStartDate,
    },
    posted.map((p) => ({
      periodStart: p.periodStart,
      amount: Number(p.amount),
      openingBookValue: Number(p.openingBookValue),
      closingBookValue: Number(p.closingBookValue),
      journalEntryId: p.journalEntryId,
    })),
    projected,
  );

  return NextResponse.json({ assetId, schedule });
}
