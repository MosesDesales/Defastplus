import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { buildEWayDraftFromDeliveryChallan } from "@/lib/eway/build-from-delivery-challan";
import { createEWayFromDeliveryChallan } from "@/lib/eway/service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const draft = await buildEWayDraftFromDeliveryChallan(session.sub, id);
  if (!draft) return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  try {
    const result = await createEWayFromDeliveryChallan(session.sub, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create" }, { status: 400 });
  }
}
