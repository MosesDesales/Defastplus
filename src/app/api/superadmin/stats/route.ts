import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { getDashboardStats } from "@/lib/superadmin/service";

export async function GET() {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json(await getDashboardStats());
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
