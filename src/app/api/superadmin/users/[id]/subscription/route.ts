import { NextResponse } from "next/server";
import { readJson, requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { changeSubscription } from "@/lib/superadmin/service";
import { subscriptionChangeSchema } from "@/lib/superadmin/validators";

type P = { params: Promise<{ id: string }> };

export async function PUT(request: Request, props: P) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await props.params;
    const body = subscriptionChangeSchema.parse(await readJson(request));
    return NextResponse.json(await changeSubscription(session.sub, id, body));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
