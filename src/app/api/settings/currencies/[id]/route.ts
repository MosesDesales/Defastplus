import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { currencyToDto } from "@/lib/currencies/dto";
import { ensureDefaultCurrencies } from "@/lib/currencies/service";
import { prisma } from "@/lib/prisma";
import { currencyUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  await ensureDefaultCurrencies(prisma, session.sub);

  const existing = await prisma.currency.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = currencyUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  if (d.isActive === false && existing.isBaseCurrency) {
    return NextResponse.json({ error: "Deactivate another currency as base before deactivating the base currency." }, { status: 400 });
  }

  const nextCode = d.code != null ? d.code.trim().toUpperCase() : undefined;
  if (nextCode && nextCode !== existing.code) {
    const clash = await prisma.currency.findUnique({
      where: { userId_code: { userId: session.sub, code: nextCode } },
    });
    if (clash) return NextResponse.json({ error: "Currency code must be unique." }, { status: 409 });
  }

  const wantsBase = d.isBaseCurrency === true;
  const rate =
    d.exchangeRate !== undefined
      ? d.exchangeRate != null && Number.isFinite(d.exchangeRate)
        ? new Prisma.Decimal(d.exchangeRate)
        : null
      : undefined;

  try {
    if (wantsBase) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.currency.updateMany({
          where: { userId: session.sub },
          data: { isBaseCurrency: false },
        });
        const row = await tx.currency.update({
          where: { id },
          data: {
            ...(nextCode != null ? { code: nextCode } : {}),
            ...(d.symbol != null ? { symbol: d.symbol.trim() } : {}),
            ...(d.name != null ? { name: d.name.trim() } : {}),
            ...(d.decimalPlaces != null ? { decimalPlaces: d.decimalPlaces } : {}),
            ...(d.formatLocale != null ? { formatLocale: d.formatLocale.trim() } : {}),
            ...(d.isActive != null ? { isActive: d.isActive } : {}),
            isBaseCurrency: true,
            exchangeRate: null,
          },
        });
        await tx.companyProfile.upsert({
          where: { userId: session.sub },
          create: {
            userId: session.sub,
            currency: row.code,
            billingCountry: "IN",
            companyName: "",
          },
          update: { currency: row.code },
        });
        return row;
      });
      return NextResponse.json({ currency: currencyToDto(updated) });
    }

    const data: Prisma.CurrencyUpdateInput = {};
    if (nextCode != null) data.code = nextCode;
    if (d.symbol != null) data.symbol = d.symbol.trim();
    if (d.name != null) data.name = d.name.trim();
    if (d.decimalPlaces != null) data.decimalPlaces = d.decimalPlaces;
    if (d.formatLocale != null) data.formatLocale = d.formatLocale.trim();
    if (d.isActive != null) data.isActive = d.isActive;
    if (rate !== undefined) {
      data.exchangeRate = rate;
      data.rateUpdatedAt = rate ? new Date() : null;
    }

    const updated = await prisma.currency.update({
      where: { id },
      data,
    });
    return NextResponse.json({ currency: currencyToDto(updated) });
  } catch (e) {
    console.error("PUT /api/settings/currencies/[id]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Currency code must be unique." }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "Could not update currency.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
