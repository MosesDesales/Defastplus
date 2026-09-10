import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { hasOverlap } from "@/lib/time-tracking/invoice-from-entries";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workTaskTimerStartSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deniedTasks = await requireApiModules(session.sub, "tasks");
  if (deniedTasks) return deniedTasks;
  const deniedTime = await requireApiModules(session.sub, "time_tracking");
  if (deniedTime) return deniedTime;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workTaskTimerStartSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, userId: session.sub } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const task = await prisma.workTask.findFirst({
    where: { id: d.workTaskId, userId: session.sub },
    select: { id: true, timeProjectId: true, billable: true, title: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const otherRunning = await prisma.timeEntry.findFirst({
    where: { userId: session.sub, isRunning: true },
  });
  if (otherRunning) {
    return NextResponse.json(
      { error: "Another timer is already running.", entryId: otherRunning.id },
      { status: 409 },
    );
  }

  const now = new Date();
  const workDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  if (await hasOverlap(prisma, session.sub, d.employeeId, now, new Date(now.getTime() + 1000))) {
    return NextResponse.json({ error: "Another logged interval is active at this time." }, { status: 400 });
  }

  const row = await prisma.timeEntry.create({
    data: {
      userId: session.sub,
      employeeId: d.employeeId,
      projectId: task.timeProjectId,
      workTaskId: task.id,
      workDate,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      billable: task.billable,
      notes: d.notes?.trim() || task.title,
      isRunning: true,
      isManual: false,
      updatedAt: now,
    },
  });

  if (task.status === "OPEN") {
    await prisma.workTask.update({
      where: { id: task.id },
      data: { status: "IN_PROGRESS" },
    });
  }

  return NextResponse.json({ id: row.id, startedAt: row.startedAt!.toISOString() }, { status: 201 });
}
