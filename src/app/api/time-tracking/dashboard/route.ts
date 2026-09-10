import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { liveDurationSeconds } from "@/lib/time-tracking/timer-helpers";

export const runtime = "nodejs";

function dayBounds(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const weekAnchor = searchParams.get("week") ?? undefined;
  const anchor = weekAnchor ? parseYmd(weekAnchor) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  const today = new Date();
  const { start: todayStart, end: todayEnd } = dayBounds(today);

  const entriesToday = await prisma.timeEntry.findMany({
    where: { userId: session.sub, workDate: { gte: todayStart, lte: todayEnd } },
    select: {
      durationSeconds: true,
      billable: true,
      isRunning: true,
      startedAt: true,
    },
  });

  let totalToday = 0;
  let billableToday = 0;
  let nonBillableToday = 0;
  for (const e of entriesToday) {
    const sec = liveDurationSeconds(e);
    totalToday += sec;
    if (e.billable) billableToday += sec;
    else nonBillableToday += sec;
  }

  const activeTimers = await prisma.timeEntry.count({
    where: { userId: session.sub, isRunning: true },
  });

  const weekStart = new Date(anchor);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekEntries = await prisma.timeEntry.findMany({
    where: { userId: session.sub, workDate: { gte: weekStart, lte: weekEnd } },
    select: {
      workDate: true,
      durationSeconds: true,
      billable: true,
      isRunning: true,
      startedAt: true,
    },
  });

  const byDay: Record<string, { total: number; billable: number }> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { total: 0, billable: 0 };
  }
  for (const e of weekEntries) {
    const key = e.workDate.toISOString().slice(0, 10);
    if (!byDay[key]) continue;
    const sec = liveDurationSeconds(e);
    byDay[key]!.total += sec;
    if (e.billable) byDay[key]!.billable += sec;
  }

  const recent = await prisma.timeEntry.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      employee: { select: { displayName: true } },
      project: { select: { name: true } },
      task: { select: { name: true } },
    },
  });

  const projects = await prisma.timeProject.findMany({
    where: { userId: session.sub, status: "ACTIVE" },
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { displayName: true } },
    },
  });

  const projectAgg = await prisma.timeEntry.groupBy({
    by: ["projectId"],
    where: { userId: session.sub, projectId: { not: null } },
    _sum: { durationSeconds: true },
  });
  const hoursByProject = new Map(projectAgg.map((g) => [g.projectId!, g._sum.durationSeconds ?? 0]));

  const teamGrouped = await prisma.timeEntry.groupBy({
    by: ["employeeId"],
    where: { userId: session.sub, workDate: { gte: todayStart, lte: todayEnd } },
    _count: { _all: true },
  });
  const teamIds = teamGrouped.map((g) => g.employeeId);
  const teamEmployees = await prisma.employee.findMany({
    where: { userId: session.sub, id: { in: teamIds } },
    select: { id: true, displayName: true },
  });
  const teamMap = new Map(teamEmployees.map((e) => [e.id, e.displayName]));

  return NextResponse.json({
    today: {
      totalSeconds: totalToday,
      billableSeconds: billableToday,
      nonBillableSeconds: nonBillableToday,
    },
    activeTimers,
    week: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      byDay,
    },
    recentEntries: recent.map((r) => ({
      id: r.id,
      employeeName: r.employee.displayName,
      projectName: r.project?.name ?? "—",
      taskName: r.task?.name ?? null,
      durationSeconds: liveDurationSeconds(r),
      billable: r.billable,
      workDate: r.workDate.toISOString(),
      isRunning: r.isRunning,
      updatedAt: r.updatedAt.toISOString(),
    })),
    projectProgress: projects.map((p) => {
      const logged = hoursByProject.get(p.id) ?? 0;
      const budget = p.budgetHours != null ? Number(p.budgetHours) * 3600 : null;
      const pct = budget && budget > 0 ? Math.min(100, Math.round((logged / budget) * 100)) : p.progressPercent;
      return {
        id: p.id,
        name: p.name,
        customerName: p.customer.displayName,
        loggedSeconds: logged,
        budgetHours: p.budgetHours != null ? Number(p.budgetHours) : null,
        progressPercent: pct,
      };
    }),
    teamToday: teamGrouped.map((t) => ({
      employeeId: t.employeeId,
      name: teamMap.get(t.employeeId) ?? t.employeeId,
      entries: t._count._all,
    })),
  });
}
