import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationSettingsRow } from "@/lib/organization-settings-db";
import { currencyFeedsSchema } from "@/lib/validators";

export async function PUT(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = currencyFeedsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await getOrCreateOrganizationSettingsRow(session.sub);
  await prisma.organizationSettings.update({
    where: { id: row.id },
    data: { exchangeRateFeedsEnabled: parsed.data.exchangeRateFeedsEnabled },
  });

  return NextResponse.json({ ok: true, exchangeRateFeedsEnabled: parsed.data.exchangeRateFeedsEnabled });
}
