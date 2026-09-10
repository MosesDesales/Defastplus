import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;

  const t = await prisma.timesheet.findFirst({
    where: { id, userId: session.sub },
    include: {
      employee: { select: { id: true, displayName: true } },
      entries: {
        orderBy: { workDate: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    timesheet: {
      id: t.id,
      employeeId: t.employeeId,
      employeeName: t.employee.displayName,
      periodStart: t.periodStart.toISOString(),
      periodEnd: t.periodEnd.toISOString(),
      status: t.status,
      totalSeconds: t.totalSeconds,
      submittedAt: t.submittedAt?.toISOString() ?? null,
      reviewedAt: t.reviewedAt?.toISOString() ?? null,
      reviewNotes: t.reviewNotes,
      payrollSyncedAt: t.payrollSyncedAt?.toISOString() ?? null,
      entries: t.entries.map((e) => ({
        id: e.id,
        workDate: e.workDate.toISOString(),
        projectId: e.projectId,
        projectName: e.project?.name ?? null,
        taskId: e.taskId,
        taskName: e.task?.name ?? null,
        durationSeconds: e.durationSeconds,
        billable: e.billable,
        notes: e.notes,
        invoiceId: e.invoiceId,
        isRunning: e.isRunning,
      })),
    },
  });
}
