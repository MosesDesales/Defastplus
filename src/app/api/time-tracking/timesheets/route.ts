import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { timesheetCreateSchema } from "@/lib/validators";
import { parseYmd } from "@/lib/dates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const rows = await prisma.timesheet.findMany({
    where: {
      userId: session.sub,
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" } : {}),
    },
    orderBy: { periodStart: "desc" },
    take: 200,
    include: {
      employee: { select: { id: true, displayName: true } },
      reviewerUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    timesheets: rows.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      employeeName: t.employee.displayName,
      periodStart: t.periodStart.toISOString(),
      periodEnd: t.periodEnd.toISOString(),
      status: t.status,
      totalSeconds: t.totalSeconds,
      submittedAt: t.submittedAt?.toISOString() ?? null,
      reviewedAt: t.reviewedAt?.toISOString() ?? null,
      reviewerUserId: t.reviewerUserId,
      reviewerName: t.reviewerUser?.name ?? null,
      reviewNotes: t.reviewNotes,
      payrollSyncedAt: t.payrollSyncedAt?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
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
  const parsed = timesheetCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, userId: session.sub } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const periodStart = parseYmd(d.periodStart);
  const periodEnd = parseYmd(d.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(23, 59, 59, 999);
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "periodEnd must be on or after periodStart" }, { status: 400 });
  }

  const overlap = await prisma.timesheet.findFirst({
    where: {
      userId: session.sub,
      employeeId: d.employeeId,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
  });
  if (overlap) {
    return NextResponse.json({ error: "A timesheet already exists for an overlapping period." }, { status: 400 });
  }

  const t = await prisma.timesheet.create({
    data: {
      userId: session.sub,
      employeeId: d.employeeId,
      periodStart,
      periodEnd,
      status: "DRAFT",
      totalSeconds: 0,
    },
  });

  return NextResponse.json({ id: t.id }, { status: 201 });
}
