import { NextResponse } from "next/server";
import { readJson, requireSuperUserApi, superAdminErrorResponse } from "@/lib/superadmin/guard";
import { getUserDetail, updateModuleAssignments } from "@/lib/superadmin/service";
import { moduleAssignmentSchema } from "@/lib/superadmin/validators";

type P = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: P) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await props.params;
    const { user } = await getUserDetail(id);
    return NextResponse.json({
      restricted: user.moduleAccessRestricted,
      assignedModules: user.assignedModules,
      effectiveModules: user.effectiveModules,
    });
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}

export async function PUT(request: Request, props: P) {
  const session = await requireSuperUserApi();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await props.params;
    const body = moduleAssignmentSchema.parse(await readJson(request));
    return NextResponse.json(await updateModuleAssignments(session.sub, id, body.restricted, body.modules));
  } catch (e) {
    return superAdminErrorResponse(e);
  }
}
