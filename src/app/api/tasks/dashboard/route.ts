import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { isWorkTaskOverdue } from "@/lib/tasks/helpers";
import { workTaskListInclude, workTaskToDto } from "@/lib/tasks/dto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

function dayBounds(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const userId = session.sub;
  const today = new Date();
  const { start: todayStart, end: todayEnd } = dayBounds(today);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const [total, pending, inProgress, completed, allOpen] = await Promise.all([
    prisma.workTask.count({ where: { userId } }),
    prisma.workTask.count({ where: { userId, status: "OPEN" } }),
    prisma.workTask.count({ where: { userId, status: "IN_PROGRESS" } }),
    prisma.workTask.count({ where: { userId, status: "COMPLETED" } }),
    prisma.workTask.findMany({
      where: {
        userId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        dueDate: { not: null },
      },
      select: { dueDate: true, status: true },
    }),
  ]);

  const overdue = allOpen.filter((t) => isWorkTaskOverdue(t)).length;

  const [todayTasks, upcoming, recent, teamActivity] = await Promise.all([
    prisma.workTask.findMany({
      where: {
        userId,
        OR: [
          { dueDate: { gte: todayStart, lte: todayEnd } },
          { startDate: { gte: todayStart, lte: todayEnd } },
        ],
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      include: workTaskListInclude,
    }),
    prisma.workTask.findMany({
      where: {
        userId,
        dueDate: { gt: todayEnd, lte: weekEnd },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: workTaskListInclude,
    }),
    prisma.workTask.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: workTaskListInclude,
    }),
    prisma.workTask.groupBy({
      by: ["assignedEmployeeId"],
      where: { userId, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      _count: { _all: true },
    }),
  ]);

  const empIds = teamActivity.map((g) => g.assignedEmployeeId).filter(Boolean) as string[];
  const employees = await prisma.employee.findMany({
    where: { userId, id: { in: empIds } },
    select: { id: true, displayName: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e.displayName]));

  return NextResponse.json({
    summary: { total, pending, inProgress, completed, overdue },
    todayTasks: todayTasks.map(workTaskToDto),
    upcomingDeadlines: upcoming.map(workTaskToDto),
    recentlyUpdated: recent.map(workTaskToDto),
    teamActivity: teamActivity
      .filter((g) => g.assignedEmployeeId)
      .map((g) => ({
        employeeId: g.assignedEmployeeId!,
        name: empMap.get(g.assignedEmployeeId!) ?? "Unassigned",
        updates: g._count._all,
      })),
  });
}
