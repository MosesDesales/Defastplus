import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { extendEWayValidity } from "@/lib/eway/service";

const schema = z.object({ reason: z.string().max(500).optional() });

/** POST /api/gst/eway-bills/[id]/extend */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  let reason: string | undefined;
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (parsed.success) reason = parsed.data.reason;
  } catch {
    /* optional */
  }

  try {
    const bill = await extendEWayValidity(session.sub, id, reason);
    return NextResponse.json(bill);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Extension failed" }, { status: 400 });
  }
}
