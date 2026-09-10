import { Prisma, WorkTaskPriority, WorkTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiModules } from "@/lib/api-require-module";
import { parseYmd } from "@/lib/dates";
import { workTaskListInclude, workTaskToDto } from "@/lib/tasks/dto";
import { syncTimeProjectProgressFromWorkTasks } from "@/lib/tasks/helpers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workTaskCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

function buildWhere(
  userId: string,
  params: URLSearchParams,
  mineEmployeeId: string | null,
): Prisma.WorkTaskWhereInput {
  const where: Prisma.WorkTaskWhereInput = { userId };
  const status = params.get("status");
  const assignee = params.get("assignee");
  const projectId = params.get("projectId");
  const priority = params.get("priority");
  const customerId = params.get("customerId");
  const q = params.get("q")?.trim();
  const dueBefore = params.get("dueBefore");
  const dueAfter = params.get("dueAfter");
  const completed = params.get("completed");

  if (completed === "1") {
    where.status = "COMPLETED";
  } else if (completed === "0") {
    where.status = { notIn: ["COMPLETED", "CANCELLED"] };
  } else if (status) {
    where.status = status as WorkTaskStatus;
  }
  if (assignee === "mine" && mineEmployeeId) {
    where.assignedEmployeeId = mineEmployeeId;
  } else if (assignee && assignee !== "all") {
    where.assignedEmployeeId = assignee;
  }
  if (projectId) where.timeProjectId = projectId;
  if (priority) where.priority = priority as WorkTaskPriority;
  if (customerId) where.customerId = customerId;
  if (dueBefore) {
    const d = parseYmd(dueBefore);
    if (!Number.isNaN(d.getTime())) where.dueDate = { ...(where.dueDate as object), lte: d };
  }
  if (dueAfter) {
    const d = parseYmd(dueAfter);
    if (!Number.isNaN(d.getTime())) where.dueDate = { ...(where.dueDate as object), gte: d };
  }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { tags: { contains: q } },
      { customer: { displayName: { contains: q } } },
      { vendor: { displayName: { contains: q } } },
    ];
  }
  return where;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { email: true } });
  let mineEmployeeId: string | null = null;
  if (searchParams.get("assignee") === "mine" && user) {
    const emp = await prisma.employee.findFirst({
      where: { userId: session.sub, OR: [{ email: user.email }, { email: { not: null } }] },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    mineEmployeeId = emp?.id ?? null;
  }

  const rows = await prisma.workTask.findMany({
    where: buildWhere(session.sub, searchParams, mineEmployeeId),
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: Math.min(500, Number(searchParams.get("limit") ?? 200) || 200),
    include: workTaskListInclude,
  });

  return NextResponse.json({ tasks: rows.map(workTaskToDto) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workTaskCreateSchema.safeParse(json);
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

  const startDate = d.startDate ? parseYmd(d.startDate) : null;
  const dueDate = d.dueDate ? parseYmd(d.dueDate) : null;
  if (startDate && Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
  }

  const row = await prisma.workTask.create({
    data: {
      userId: session.sub,
      createdByUserId: session.sub,
      title: d.title,
      description: d.description?.trim() || null,
      assignedEmployeeId: d.assignedEmployeeId?.trim() || null,
      timeProjectId: d.timeProjectId?.trim() || null,
      customerId: d.customerId?.trim() || null,
      vendorId: d.vendorId?.trim() || null,
      priority: d.priority,
      status: d.status,
      startDate,
      dueDate,
      estimatedHours: d.estimatedHours ?? null,
      billable: d.billable,
      tags: d.tags?.length ? d.tags.join(",") : null,
      recurrenceRule: d.recurrenceRule?.trim() || null,
      completedAt: d.status === "COMPLETED" ? new Date() : null,
      subtasks: d.subtasks?.length
        ? {
            create: d.subtasks.map((s, i) => ({
              title: s.title,
              sortOrder: s.sortOrder ?? i,
            })),
          }
        : undefined,
    },
    include: workTaskListInclude,
  });

  if (row.timeProjectId) {
    await syncTimeProjectProgressFromWorkTasks(prisma, row.timeProjectId, session.sub);
  }

  await writeAuditLog(session.sub, "create", "work_task", row.id, { title: row.title });

  return NextResponse.json({ task: workTaskToDto(row) }, { status: 201 });
}
