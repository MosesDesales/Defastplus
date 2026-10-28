import { NextResponse } from "next/server";
import { readJson, requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { setUserActive } from "@/lib/superadmin/service";
import { userStatusSchema } from "@/lib/superadmin/validators";

type P = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: P) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await props.params;
    const body = userStatusSchema.parse(await readJson(request));
    return NextResponse.json(await setUserActive(session.sub, id, body.active, body.reason));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
