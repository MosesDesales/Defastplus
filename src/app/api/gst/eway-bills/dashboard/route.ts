import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { getEWayDashboardStats } from "@/lib/eway/service";

/** GET /api/gst/eway-bills/dashboard */
export async function GET() {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const stats = await getEWayDashboardStats(session.sub);
  return NextResponse.json(stats);
}
