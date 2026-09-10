import { NextResponse } from "next/server";
import { apiGuardsSatisfied, type ApiModuleGuard } from "@/lib/organization-module-settings";
import { getEffectiveModuleSettings } from "@/lib/organization-settings-db";

export async function requireApiModules(
  userId: string,
  ...guards: ApiModuleGuard[]
): Promise<NextResponse | null> {
  const eff = await getEffectiveModuleSettings(userId);
  if (!apiGuardsSatisfied(eff, ...guards)) {
    return NextResponse.json({ error: "This module is disabled for your organization." }, { status: 403 });
  }
  return null;
}
