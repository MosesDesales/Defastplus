import { NextResponse } from "next/server";
import { runDepreciation } from "@/lib/fixed-assets/service";
import { requireApiModules } from "@/lib/api-require-module";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { depreciationRunSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = depreciationRunSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const asOfStr = parsed.data.asOf?.trim();
  const asOf = asOfStr ? parseYmd(asOfStr) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "Invalid asOf date" }, { status: 400 });
  }

  const result = await runDepreciation(prisma, session.sub, {
    asOf,
    assetId: parsed.data.assetId,
    dryRun: parsed.data.dryRun,
  });

  return NextResponse.json(result);
}
