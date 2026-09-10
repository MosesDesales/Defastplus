import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await requireApiPermission("hr.view");
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId")?.trim() || undefined;

  const rows = await prisma.leaveEntry.findMany({
    where: { userId: session.sub, ...(employeeId ? { employeeId } : {}) },
    include: { leaveType: { select: { name: true } }, employee: { select: { displayName: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json({
    leaveEntries: rows.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      employeeName: e.employee.displayName,
      leaveTypeId: e.leaveTypeId,
      leaveTypeName: e.leaveType.name,
      date: e.date.toISOString().slice(0, 10),
      days: Number(e.days),
      notes: e.notes,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as Record<string, unknown>;
  const employeeId = String(d.employeeId ?? "").trim();
  const leaveTypeId = String(d.leaveTypeId ?? "").trim();
  const dateStr = String(d.date ?? "").trim();
  if (!employeeId || !leaveTypeId || !dateStr) {
    return NextResponse.json({ error: "employeeId, leaveTypeId, and date are required" }, { status: 400 });
  }

  const [employee, leaveType] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, userId: session.sub } }),
    prisma.leaveType.findFirst({ where: { id: leaveTypeId, userId: session.sub } }),
  ]);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!leaveType) return NextResponse.json({ error: "Leave type not found" }, { status: 404 });

  const days = Number(d.days ?? 1);
  if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "days must be a positive number" }, { status: 400 });

  const row = await prisma.leaveEntry.create({
    data: {
      userId: session.sub,
      employeeId,
      leaveTypeId,
      date: new Date(dateStr),
      days: new Prisma.Decimal(days),
      notes: d.notes ? String(d.notes).trim() : null,
    },
  });

  await writeAuditLog(session.sub, "CREATE", "LeaveEntry", row.id, { employeeId, leaveTypeId, date: dateStr, days });

  return NextResponse.json({ leaveEntry: { id: row.id } }, { status: 201 });
}
