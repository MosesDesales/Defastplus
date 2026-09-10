import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: P) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as Record<string, unknown>;

  const existing = await prisma.leaveType.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leaveType.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: String(d.name).trim() } : {}),
      ...(d.annualDays !== undefined ? { annualDays: new Prisma.Decimal(Number(d.annualDays)) } : {}),
      ...(d.isLossOfPay !== undefined ? { isLossOfPay: Boolean(d.isLossOfPay) } : {}),
      ...(d.isActive !== undefined ? { isActive: Boolean(d.isActive) } : {}),
    },
  });

  await writeAuditLog(session.sub, "UPDATE", "LeaveType", id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, props: P) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const existing = await prisma.leaveType.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leaveType.delete({ where: { id } });
  await writeAuditLog(session.sub, "DELETE", "LeaveType", id);

  return NextResponse.json({ ok: true });
}
