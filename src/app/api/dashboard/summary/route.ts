import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard-summary";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardSummary(session.sub);
  return NextResponse.json(data);
}
