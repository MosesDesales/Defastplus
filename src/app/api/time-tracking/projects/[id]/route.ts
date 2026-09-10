import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { timeProjectPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;
  const p = await prisma.timeProject.findFirst({
    where: { id, userId: session.sub },
    include: {
      customer: { select: { id: true, displayName: true } },
      members: { include: { employee: { select: { id: true, displayName: true, email: true } } } },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    project: {
      ...p,
      hourlyRate: Number(p.hourlyRate),
      budgetHours: p.budgetHours != null ? Number(p.budgetHours) : null,
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await prisma.timeProject.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeProjectPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  if (d.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: d.customerId, userId: session.sub } });
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const data: Prisma.TimeProjectUpdateInput = {};
  if (d.name != null) data.name = d.name.trim();
  if (d.description !== undefined) data.description = d.description?.trim() || null;
  if (d.hourlyRate != null) data.hourlyRate = new Prisma.Decimal(d.hourlyRate);
  if (d.billingType != null) data.billingType = d.billingType;
  if (d.budgetHours !== undefined) data.budgetHours = d.budgetHours != null ? new Prisma.Decimal(d.budgetHours) : null;
  if (d.status != null) data.status = d.status;
  if (d.progressPercent != null) data.progressPercent = d.progressPercent;
  if (d.startDate !== undefined) {
    data.startDate = d.startDate?.trim() ? new Date(d.startDate) : null;
  }
  if (d.endDate !== undefined) {
    data.endDate = d.endDate?.trim() ? new Date(d.endDate) : null;
  }
  if (d.customerId != null) data.customer = { connect: { id: d.customerId } };

  await prisma.timeProject.update({ where: { id }, data });

  if (d.memberEmployeeIds) {
    await prisma.timeProjectMember.deleteMany({ where: { projectId: id } });
    for (const eid of d.memberEmployeeIds) {
      const emp = await prisma.employee.findFirst({ where: { id: eid, userId: session.sub } });
      if (emp) await prisma.timeProjectMember.create({ data: { projectId: id, employeeId: eid } });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;
  await prisma.timeProject.deleteMany({ where: { id, userId: session.sub } });
  return NextResponse.json({ ok: true });
}
