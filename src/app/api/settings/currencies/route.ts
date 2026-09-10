import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiPermission, requireApiSession } from "@/lib/api-auth";
import { currencyToDto } from "@/lib/currencies/dto";
import {
  alignCurrencyBaseWithCompanyProfile,
  ensureDefaultCurrencies,
} from "@/lib/currencies/service";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationSettingsRow } from "@/lib/organization-settings-db";
import { currencyCreateSchema } from "@/lib/validators";

/** GET: list currencies (+ feeds flag). Any authenticated user (for dropdowns). */
export async function GET(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;

  await ensureDefaultCurrencies(prisma, session.sub);
  await alignCurrencyBaseWithCompanyProfile(prisma, session.sub);

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "1" || searchParams.get("activeOnly") === "true";

  const orgRow = await getOrCreateOrganizationSettingsRow(session.sub);

  const rows = await prisma.currency.findMany({
    where: {
      userId: session.sub,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ isBaseCurrency: "desc" }, { code: "asc" }],
  });

  return NextResponse.json({
    currencies: rows.map(currencyToDto),
    exchangeRateFeedsEnabled: orgRow.exchangeRateFeedsEnabled,
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  await ensureDefaultCurrencies(prisma, session.sub);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = currencyCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const clash = await prisma.currency.findUnique({
    where: { userId_code: { userId: session.sub, code: d.code } },
  });
  if (clash) {
    return NextResponse.json({ error: "Currency code must be unique." }, { status: 409 });
  }

  const isBase = Boolean(d.isBaseCurrency);
  const baseRow = await prisma.currency.findFirst({
    where: { userId: session.sub, isBaseCurrency: true },
  });
  const rate =
    d.exchangeRate != null && Number.isFinite(d.exchangeRate) ? new Prisma.Decimal(d.exchangeRate) : null;

  try {
    if (isBase) {
      const created = await prisma.$transaction(async (tx) => {
        await tx.currency.updateMany({
          where: { userId: session.sub },
          data: { isBaseCurrency: false },
        });
        const row = await tx.currency.create({
          data: {
            userId: session.sub,
            code: d.code,
            symbol: d.symbol.trim(),
            name: d.name.trim(),
            decimalPlaces: d.decimalPlaces,
            formatLocale: d.formatLocale.trim(),
            isBaseCurrency: true,
            exchangeRate: null,
            isActive: d.isActive ?? true,
          },
        });
        await tx.companyProfile.upsert({
          where: { userId: session.sub },
          create: {
            userId: session.sub,
            currency: d.code,
            billingCountry: "IN",
            companyName: "",
          },
          update: { currency: d.code },
        });
        return row;
      });
      return NextResponse.json({ currency: currencyToDto(created) });
    }

    const created = await prisma.currency.create({
      data: {
        userId: session.sub,
        code: d.code,
        symbol: d.symbol.trim(),
        name: d.name.trim(),
        decimalPlaces: d.decimalPlaces,
        formatLocale: d.formatLocale.trim(),
        isBaseCurrency: false,
        exchangeRate: baseRow ? rate : null,
        rateUpdatedAt: rate ? new Date() : null,
        isActive: d.isActive ?? true,
      },
    });
    return NextResponse.json({ currency: currencyToDto(created) });
  } catch (e) {
    console.error("POST /api/settings/currencies", e);
    const msg = e instanceof Error ? e.message : "Could not create currency.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
