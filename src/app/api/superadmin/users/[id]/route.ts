import { NextResponse } from "next/server";
import { requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { getUserDetail } from "@/lib/superadmin/service";

type P = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: P) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await props.params;
    return NextResponse.json(await getUserDetail(id));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
