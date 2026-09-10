import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, props: P) {
  const session = await requireApiPermission("hr.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const existing = await prisma.leaveEntry.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leaveEntry.delete({ where: { id } });
  await writeAuditLog(session.sub, "DELETE", "LeaveEntry", id);

  return NextResponse.json({ ok: true });
}
