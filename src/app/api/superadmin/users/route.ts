import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { listUsers } from "@/lib/superadmin/service";
import { searchParamsToObject, userListQuerySchema } from "@/lib/superadmin/validators";

export async function GET(request: Request) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const q = userListQuerySchema.parse(searchParamsToObject(new URL(request.url).searchParams));
    return NextResponse.json(await listUsers(q));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
