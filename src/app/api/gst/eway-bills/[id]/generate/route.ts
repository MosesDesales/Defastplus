import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { generateEWayBill } from "@/lib/eway/service";

/** POST /api/gst/eway-bills/[id]/generate */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  try {
    const result = await generateEWayBill(session.sub, id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 400 });
  }
}
