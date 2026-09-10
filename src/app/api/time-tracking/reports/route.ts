import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYmd } from "@/lib/dates";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { hoursFromSeconds } from "@/lib/time-tracking/invoice-from-entries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "employee_hours";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }
  const fromD = parseYmd(from);
  const toD = parseYmd(to);
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  fromD.setHours(0, 0, 0, 0);
  toD.setHours(23, 59, 59, 999);

  const employeeId = searchParams.get("employeeId") ?? undefined;

  const baseWhere = {
    userId: session.sub,
    workDate: { gte: fromD, lte: toD },
    ...(employeeId ? { employeeId } : {}),
  };

  if (type === "employee_hours") {
    const rows = await prisma.timeEntry.groupBy({
      by: ["employeeId"],
      where: baseWhere,
      _sum: { durationSeconds: true },
    });
    const emps = await prisma.employee.findMany({
      where: { userId: session.sub, id: { in: rows.map((r) => r.employeeId) } },
      select: { id: true, displayName: true },
    });
    const map = new Map(emps.map((e) => [e.id, e.displayName]));
    return NextResponse.json({
      report: rows.map((r) => ({
        employeeId: r.employeeId,
        name: map.get(r.employeeId) ?? r.employeeId,
        hours: hoursFromSeconds(r._sum.durationSeconds ?? 0),
        seconds: r._sum.durationSeconds ?? 0,
      })),
    });
  }

  if (type === "billable_split") {
    const bill = await prisma.timeEntry.aggregate({
      where: { ...baseWhere, billable: true },
      _sum: { durationSeconds: true },
    });
    const non = await prisma.timeEntry.aggregate({
      where: { ...baseWhere, billable: false },
      _sum: { durationSeconds: true },
    });
    const bs = bill._sum.durationSeconds ?? 0;
    const ns = non._sum.durationSeconds ?? 0;
    return NextResponse.json({
      report: {
        billableSeconds: bs,
        nonBillableSeconds: ns,
        billableHours: hoursFromSeconds(bs),
        nonBillableHours: hoursFromSeconds(ns),
      },
    });
  }

  if (type === "profitability") {
    const byProject = await prisma.timeEntry.groupBy({
      by: ["projectId"],
      where: { ...baseWhere, projectId: { not: null } },
      _sum: { durationSeconds: true },
    });
    const ids = byProject.map((p) => p.projectId!).filter(Boolean);
    const projects = await prisma.timeProject.findMany({
      where: { userId: session.sub, id: { in: ids } },
      select: { id: true, name: true, hourlyRate: true },
    });
    const pmap = new Map(projects.map((p) => [p.id, p]));
    return NextResponse.json({
      report: byProject.map((row) => {
        const p = pmap.get(row.projectId!);
        const sec = row._sum.durationSeconds ?? 0;
        const hrs = sec / 3600;
        const rate = p ? Number(p.hourlyRate) : 0;
        const revenue = Math.round(hrs * rate * 100) / 100;
        return {
          projectId: row.projectId,
          name: p?.name ?? row.projectId,
          hours: hoursFromSeconds(sec),
          revenue,
          note: "Employee cost requires payroll rates — profit is revenue placeholder only.",
        };
      }),
    });
  }

  if (type === "timesheet_summary") {
    const rows = await prisma.timesheet.findMany({
      where: {
        userId: session.sub,
        ...(employeeId ? { employeeId } : {}),
        periodStart: { lte: toD },
        periodEnd: { gte: fromD },
      },
      orderBy: { periodStart: "desc" },
      take: 200,
      include: { employee: { select: { displayName: true } } },
    });
    return NextResponse.json({
      report: rows.map((t) => ({
        id: t.id,
        employeeName: t.employee.displayName,
        periodStart: t.periodStart.toISOString(),
        periodEnd: t.periodEnd.toISOString(),
        status: t.status,
        totalHours: hoursFromSeconds(t.totalSeconds),
      })),
    });
  }

  if (type === "productivity") {
    const byDay = await prisma.timeEntry.groupBy({
      by: ["workDate"],
      where: baseWhere,
      _sum: { durationSeconds: true },
    });
    return NextResponse.json({
      report: byDay.map((d) => ({
        date: d.workDate.toISOString().slice(0, 10),
        hours: hoursFromSeconds(d._sum.durationSeconds ?? 0),
      })),
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
