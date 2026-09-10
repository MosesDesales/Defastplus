import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  const where: { userId: string; isRunning: boolean; employeeId?: string } = {
    userId: session.sub,
    isRunning: true,
  };
  if (employeeId) where.employeeId = employeeId;

  const row = await prisma.timeEntry.findFirst({
    where,
    include: {
      employee: { select: { id: true, displayName: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, name: true } },
    },
  });

  if (!row) return NextResponse.json({ active: null });

  const liveDurationSeconds =
    row.durationSeconds +
    (row.isRunning && row.startedAt ? Math.max(0, Math.floor((Date.now() - row.startedAt.getTime()) / 1000)) : 0);

  return NextResponse.json({
    active: {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employee.displayName,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      taskId: row.taskId,
      taskName: row.task?.name ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      durationSeconds: row.durationSeconds,
      isRunning: row.isRunning,
      liveDurationSeconds,
      notes: row.notes,
      workDate: row.workDate.toISOString(),
    },
  });
}
