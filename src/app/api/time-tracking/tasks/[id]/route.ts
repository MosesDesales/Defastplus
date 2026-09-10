import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { timeTaskPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.timeTask.findFirst({
    where: { id, project: { userId: session.sub } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeTaskPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  if (d.assignedEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: d.assignedEmployeeId, userId: session.sub } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const data: Prisma.TimeTaskUpdateInput = {};
  if (d.name != null) data.name = d.name.trim();
  if (d.assignedEmployeeId !== undefined) {
    data.assignedEmployee =
      d.assignedEmployeeId?.trim() ? { connect: { id: d.assignedEmployeeId.trim() } } : { disconnect: true };
  }
  if (d.estimatedHours !== undefined) data.estimatedHours = d.estimatedHours != null ? new Prisma.Decimal(d.estimatedHours) : null;
  if (d.billable != null) data.billable = d.billable;
  if (d.priority != null) data.priority = d.priority;
  if (d.status != null) data.status = d.status;
  if (d.sortOrder != null) data.sortOrder = d.sortOrder;

  await prisma.timeTask.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;
  await prisma.timeTask.deleteMany({ where: { id, project: { userId: session.sub } } });
  return NextResponse.json({ ok: true });
}
