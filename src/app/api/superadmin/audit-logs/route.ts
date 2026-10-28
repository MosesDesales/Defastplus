import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { listAuditLogs } from "@/lib/superadmin/service";
import { auditQuerySchema, searchParamsToObject } from "@/lib/superadmin/validators";

export async function GET(request: Request) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const q = auditQuerySchema.parse(searchParamsToObject(new URL(request.url).searchParams));
    return NextResponse.json(await listAuditLogs(q));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
