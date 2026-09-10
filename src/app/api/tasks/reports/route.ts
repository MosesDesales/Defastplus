import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { isWorkTaskOverdue } from "@/lib/tasks/helpers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const userId = session.sub;
  const tasks = await prisma.workTask.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignedEmployeeId: true,
      billable: true,
      actualSeconds: true,
      completedAt: true,
      assignedEmployee: { select: { displayName: true } },
    },
  });

  const completionByStatus = {
    open: tasks.filter((t) => t.status === "OPEN").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    review: tasks.filter((t) => t.status === "WAITING_REVIEW").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    cancelled: tasks.filter((t) => t.status === "CANCELLED").length,
  };

  const overdue = tasks
    .filter((t) => isWorkTaskOverdue(t))
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate?.toISOString() ?? null,
      assigneeName: t.assignedEmployee?.displayName ?? null,
    }));

  const byEmployee = new Map<string, { name: string; completed: number; open: number; billableSeconds: number }>();
  for (const t of tasks) {
    const key = t.assignedEmployeeId ?? "_unassigned";
    const name = t.assignedEmployee?.displayName ?? "Unassigned";
    const cur = byEmployee.get(key) ?? { name, completed: 0, open: 0, billableSeconds: 0 };
    if (t.status === "COMPLETED") cur.completed += 1;
    else if (t.status !== "CANCELLED") cur.open += 1;
    if (t.billable) cur.billableSeconds += t.actualSeconds;
    byEmployee.set(key, cur);
  }

  const billableHours = tasks
    .filter((t) => t.billable)
    .reduce((s, t) => s + t.actualSeconds, 0);

  return NextResponse.json({
    completionByStatus,
    overdueTasks: overdue,
    employeeProductivity: [...byEmployee.entries()].map(([employeeId, v]) => ({
      employeeId: employeeId === "_unassigned" ? null : employeeId,
      ...v,
      billableHours: (v.billableSeconds / 3600).toFixed(2),
    })),
    billableHoursTotal: (billableHours / 3600).toFixed(2),
  });
}
