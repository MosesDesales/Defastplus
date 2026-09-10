import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { updateEWayVehicle } from "@/lib/eway/service";

const schema = z.object({
  vehicleNumber: z.string().min(4).max(20),
  transportMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]).optional(),
  reason: z.string().max(500).optional(),
});

/** POST /api/gst/eway-bills/[id]/vehicle */
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
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const bill = await updateEWayVehicle(session.sub, id, parsed.data);
    return NextResponse.json(bill);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vehicle update failed" }, { status: 400 });
  }
}
