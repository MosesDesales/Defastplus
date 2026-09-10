import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYmd } from "@/lib/dates";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import {
  assertDailyCap,
  hasOverlap,
} from "@/lib/time-tracking/invoice-from-entries";
import { liveDurationSeconds } from "@/lib/time-tracking/timer-helpers";
import { timeEntryManualSchema } from "@/lib/validators";

export const runtime = "nodejs";

function serializeEntry(e: {
  id: string;
  employeeId: string;
  projectId: string | null;
  taskId: string | null;
  timesheetId: string | null;
  workDate: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number;
  billable: boolean;
  notes: string | null;
  isRunning: boolean;
  isManual: boolean;
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    projectId: e.projectId,
    taskId: e.taskId,
    timesheetId: e.timesheetId,
    workDate: e.workDate.toISOString(),
    startedAt: e.startedAt?.toISOString() ?? null,
    endedAt: e.endedAt?.toISOString() ?? null,
    durationSeconds: e.durationSeconds,
    liveDurationSeconds: liveDurationSeconds(e),
    billable: e.billable,
    notes: e.notes,
    isRunning: e.isRunning,
    isManual: e.isManual,
    invoiceId: e.invoiceId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const take = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "200") || 200));

  const where: Prisma.TimeEntryWhereInput = { userId: session.sub };
  if (employeeId) where.employeeId = employeeId;
  if (projectId) where.projectId = projectId;
  if (from && to) {
    const fromD = parseYmd(from);
    const toD = parseYmd(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
      return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
    }
    fromD.setHours(0, 0, 0, 0);
    toD.setHours(23, 59, 59, 999);
    where.workDate = { gte: fromD, lte: toD };
  }

  const rows = await prisma.timeEntry.findMany({
    where,
    orderBy: [{ workDate: "desc" }, { updatedAt: "desc" }],
    take,
    include: {
      employee: { select: { id: true, displayName: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    entries: rows.map((r) => ({
      ...serializeEntry(r),
      employeeName: r.employee.displayName,
      projectName: r.project?.name ?? null,
      taskName: r.task?.name ?? null,
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
  const parsed = timeEntryManualSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, userId: session.sub } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const workDate = parseYmd(d.workDate);
  if (Number.isNaN(workDate.getTime())) {
    return NextResponse.json({ error: "Invalid work date" }, { status: 400 });
  }

  let projectId: string | null = d.projectId?.trim() || null;
  let taskId: string | null = d.taskId?.trim() || null;
  if (projectId) {
    const p = await prisma.timeProject.findFirst({ where: { id: projectId, userId: session.sub } });
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (taskId) {
    const t = await prisma.timeTask.findFirst({
      where: { id: taskId, project: { userId: session.sub } },
      include: { project: true },
    });
    if (!t) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (projectId && t.projectId !== projectId) {
      return NextResponse.json({ error: "Task does not belong to project" }, { status: 400 });
    }
    if (!projectId) projectId = t.projectId;
  }

  let timesheetId: string | null = d.timesheetId?.trim() || null;
  if (timesheetId) {
    const ts = await prisma.timesheet.findFirst({
      where: { id: timesheetId, userId: session.sub, employeeId: d.employeeId },
    });
    if (!ts) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    if (ts.status !== "DRAFT" && ts.status !== "REJECTED") {
      return NextResponse.json({ error: "Timesheet is not editable" }, { status: 400 });
    }
  }

  const seconds = Math.round(d.hours * 3600);
  if (seconds <= 0) return NextResponse.json({ error: "Hours must be positive" }, { status: 400 });

  try {
    await assertDailyCap(prisma, session.sub, d.employeeId, workDate, seconds);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Daily cap exceeded" }, { status: 400 });
  }

  const start = new Date(workDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + seconds * 1000);
  if (await hasOverlap(prisma, session.sub, d.employeeId, start, end)) {
    return NextResponse.json({ error: "Time overlaps another logged interval for this employee." }, { status: 400 });
  }

  const row = await prisma.timeEntry.create({
    data: {
      userId: session.sub,
      employeeId: d.employeeId,
      projectId,
      taskId,
      timesheetId,
      workDate,
      startedAt: start,
      endedAt: end,
      durationSeconds: seconds,
      billable: d.billable ?? true,
      notes: d.notes?.trim() || null,
      isRunning: false,
      isManual: true,
    },
  });

  if (timesheetId) {
    const sum = await prisma.timeEntry.aggregate({
      where: { timesheetId },
      _sum: { durationSeconds: true },
    });
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { totalSeconds: sum._sum.durationSeconds ?? 0 },
    });
  }

  return NextResponse.json({ id: row.id }, { status: 201 });
}
