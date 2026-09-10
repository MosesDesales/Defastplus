import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { buildEWayDraftFromPurchaseReturn } from "@/lib/eway/build-from-purchase-return";
import { createEWayFromPurchaseReturn } from "@/lib/eway/service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const draft = await buildEWayDraftFromPurchaseReturn(session.sub, id);
  if (!draft) return NextResponse.json({ error: "Purchase return not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  try {
    const result = await createEWayFromPurchaseReturn(session.sub, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create" }, { status: 400 });
  }
}
