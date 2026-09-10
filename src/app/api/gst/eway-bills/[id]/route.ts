import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { cancelEWayBill, getEWayBill, updateEWayDraft } from "@/lib/eway/service";

const patchSchema = z.object({
  transportMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]).optional(),
  vehicleNumber: z.string().optional(),
  distanceKm: z.coerce.number().int().min(1).max(4000).optional(),
  transporterName: z.string().optional(),
  transporterGstin: z.string().optional(),
  transporterId: z.string().optional(),
  status: z.enum(["DRAFT", "READY"]).optional(),
});

/** GET /api/gst/eway-bills/[id] */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const bill = await getEWayBill(session.sub, id);
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bill);
}

/** PATCH /api/gst/eway-bills/[id] */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const bill = await updateEWayDraft(session.sub, id, parsed.data);
    return NextResponse.json(bill);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

const cancelSchema = z.object({ reason: z.string().min(3).max(500) });

/** DELETE /api/gst/eway-bills/[id] — cancel */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  let reason = "Cancelled by user";
  try {
    const json = await request.json();
    const parsed = cancelSchema.safeParse(json);
    if (parsed.success) reason = parsed.data.reason;
  } catch {
    /* default reason */
  }

  try {
    const bill = await cancelEWayBill(session.sub, id, reason);
    return NextResponse.json(bill);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Cancel failed" }, { status: 400 });
  }
}
