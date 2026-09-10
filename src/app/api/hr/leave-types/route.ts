import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireApiPermission("hr.view");
  if (session instanceof NextResponse) return session;

  const rows = await prisma.leaveType.findMany({
    where: { userId: session.sub },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    leaveTypes: rows.map((t) => ({
      id: t.id,
      name: t.name,
      annualDays: Number(t.annualDays),
      isLossOfPay: t.isLossOfPay,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
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
  const name = String(d.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const n = await prisma.leaveType.count({ where: { userId: session.sub } });

  const row = await prisma.leaveType.create({
    data: {
      userId: session.sub,
      name,
      annualDays: new Prisma.Decimal(Number(d.annualDays ?? 0)),
      isLossOfPay: Boolean(d.isLossOfPay),
      sortOrder: n,
    },
  });

  await writeAuditLog(session.sub, "CREATE", "LeaveType", row.id);

  return NextResponse.json({ leaveType: { id: row.id, name: row.name } }, { status: 201 });
}
