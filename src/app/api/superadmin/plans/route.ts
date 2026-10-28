import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { listPlans } from "@/lib/superadmin/service";

export async function GET() {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json({ plans: await listPlans(), currency: "INR", pricesExclusiveOfGst: true });
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
