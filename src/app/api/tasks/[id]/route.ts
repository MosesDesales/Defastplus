import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiModules } from "@/lib/api-require-module";
import { parseYmd } from "@/lib/dates";
import { workTaskListInclude, workTaskToDto } from "@/lib/tasks/dto";
import { syncTimeProjectProgressFromWorkTasks } from "@/lib/tasks/helpers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workTaskPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id } = await ctx.params;
  const row = await prisma.workTask.findFirst({
    where: { id, userId: session.sub },
    include: {
      ...workTaskListInclude,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      timeEntries: {
        orderBy: { workDate: "desc" },
        take: 50,
        include: {
          employee: { select: { displayName: true } },
        },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activity = await prisma.auditLog.findMany({
    where: { userId: session.sub, entity: "work_task", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    task: workTaskToDto(row),
    subtasks: row.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      sortOrder: s.sortOrder,
    })),
    comments: row.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: { id: c.user.id, name: c.user.name, email: c.user.email },
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
    })),
    timeLogs: row.timeEntries.map((e) => ({
      id: e.id,
      workDate: e.workDate.toISOString(),
      durationSeconds: e.durationSeconds,
      billable: e.billable,
      notes: e.notes,
      employeeName: e.employee.displayName,
      isRunning: e.isRunning,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      meta: a.meta,
    })),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.workTask.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workTaskPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  if (d.assignedEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: d.assignedEmployeeId, userId: session.sub } });
    if (!emp) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }
  if (d.timeProjectId) {
    const p = await prisma.timeProject.findFirst({ where: { id: d.timeProjectId, userId: session.sub } });
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (d.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: d.customerId, userId: session.sub } });
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  if (d.vendorId) {
    const v = await prisma.vendor.findFirst({ where: { id: d.vendorId, userId: session.sub } });
    if (!v) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (d.title != null) data.title = d.title;
  if (d.description !== undefined) data.description = d.description?.trim() || null;
  if (d.assignedEmployeeId !== undefined) data.assignedEmployeeId = d.assignedEmployeeId?.trim() || null;
  if (d.timeProjectId !== undefined) data.timeProjectId = d.timeProjectId?.trim() || null;
  if (d.customerId !== undefined) data.customerId = d.customerId?.trim() || null;
  if (d.vendorId !== undefined) data.vendorId = d.vendorId?.trim() || null;
  if (d.priority != null) data.priority = d.priority;
  if (d.status != null) {
    data.status = d.status;
    data.completedAt = d.status === "COMPLETED" ? new Date() : d.status === "CANCELLED" ? null : existing.completedAt;
    if (d.status !== "COMPLETED") data.completedAt = null;
  }
  if (d.startDate !== undefined) {
    data.startDate = d.startDate ? parseYmd(d.startDate) : null;
  }
  if (d.dueDate !== undefined) {
    data.dueDate = d.dueDate ? parseYmd(d.dueDate) : null;
  }
  if (d.estimatedHours !== undefined) data.estimatedHours = d.estimatedHours;
  if (d.billable != null) data.billable = d.billable;
  if (d.tags !== undefined) data.tags = d.tags?.length ? d.tags.join(",") : null;
  if (d.recurrenceRule !== undefined) data.recurrenceRule = d.recurrenceRule?.trim() || null;

  const prevProjectId = existing.timeProjectId;
  const row = await prisma.workTask.update({
    where: { id },
    data,
    include: workTaskListInclude,
  });

  const projectIds = new Set([prevProjectId, row.timeProjectId].filter(Boolean) as string[]);
  for (const pid of projectIds) {
    await syncTimeProjectProgressFromWorkTasks(prisma, pid, session.sub);
  }

  await writeAuditLog(session.sub, "update", "work_task", id);

  return NextResponse.json({ task: workTaskToDto(row) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.workTask.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workTask.delete({ where: { id } });
  if (existing.timeProjectId) {
    await syncTimeProjectProgressFromWorkTasks(prisma, existing.timeProjectId, session.sub);
  }
  await writeAuditLog(session.sub, "delete", "work_task", id);

  return NextResponse.json({ ok: true });
}
