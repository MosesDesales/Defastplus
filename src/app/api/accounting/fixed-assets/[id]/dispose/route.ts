import { NextResponse } from "next/server";
import { disposeFixedAsset } from "@/lib/fixed-assets/service";
import { requireApiModules } from "@/lib/api-require-module";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fixedAssetDisposalSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "fixed_assets");
  if (denied) return denied;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fixedAssetDisposalSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const proceeds = d.proceeds ?? 0;
  const res = await disposeFixedAsset(prisma, session.sub, id, {
    type: d.type,
    proceeds,
    cashAccountId: d.cashAccountId ?? null,
  });

  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, journalId: res.journalId });
}
