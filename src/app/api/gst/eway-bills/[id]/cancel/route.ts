import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { cancelEWayBill } from "@/lib/eway/service";

const schema = z.object({ reason: z.string().min(3).max(500) });

/** POST /api/gst/eway-bills/[id]/cancel */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Cancel reason required (min 3 chars)" }, { status: 400 });
  }

  try {
    const bill = await cancelEWayBill(session.sub, id, parsed.data.reason);
    return NextResponse.json(bill);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Cancel failed" }, { status: 400 });
  }
}
