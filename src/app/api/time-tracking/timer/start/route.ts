import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { hasOverlap } from "@/lib/time-tracking/invoice-from-entries";
import { timeTimerStartSchema } from "@/lib/validators";

export const runtime = "nodejs";

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
  const parsed = timeTimerStartSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, userId: session.sub } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const otherRunning = await prisma.timeEntry.findFirst({
    where: { userId: session.sub, isRunning: true },
  });
  if (otherRunning) {
    return NextResponse.json(
      { error: "Another timer is already running.", entryId: otherRunning.id },
      { status: 409 },
    );
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
    });
    if (!t) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (projectId && t.projectId !== projectId) {
      return NextResponse.json({ error: "Task does not belong to project" }, { status: 400 });
    }
    if (!projectId) projectId = t.projectId;
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
      projectId,
      taskId,
      workDate,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      billable: true,
      notes: d.notes?.trim() || null,
      isRunning: true,
      isManual: false,
    },
  });

  return NextResponse.json({ id: row.id, startedAt: row.startedAt!.toISOString() }, { status: 201 });
}
