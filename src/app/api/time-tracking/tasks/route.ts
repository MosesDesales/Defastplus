import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { timeTaskCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  const tasks = await prisma.timeTask.findMany({
    where: {
      project: { userId: session.sub },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: {
      project: { select: { id: true, name: true, customerId: true } },
      assignedEmployee: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      projectName: t.project.name,
      name: t.name,
      assignedEmployeeId: t.assignedEmployeeId,
      assigneeName: t.assignedEmployee?.displayName ?? null,
      estimatedHours: t.estimatedHours != null ? Number(t.estimatedHours) : null,
      billable: t.billable,
      priority: t.priority,
      status: t.status,
      sortOrder: t.sortOrder,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeTaskCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const proj = await prisma.timeProject.findFirst({ where: { id: d.projectId, userId: session.sub } });
  if (!proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (d.assignedEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: d.assignedEmployeeId, userId: session.sub } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const t = await prisma.timeTask.create({
    data: {
      projectId: d.projectId,
      name: d.name.trim(),
      assignedEmployeeId: d.assignedEmployeeId?.trim() || null,
      estimatedHours: d.estimatedHours != null ? new Prisma.Decimal(d.estimatedHours) : null,
      billable: d.billable ?? true,
      priority: d.priority ?? "MEDIUM",
      status: d.status ?? "OPEN",
      sortOrder: d.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ id: t.id }, { status: 201 });
}
