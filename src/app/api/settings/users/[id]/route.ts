import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import type { TeamMemberStatus } from "@prisma/client";
import { getPlanLimits } from "@/lib/superadmin/service";

type P = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: P) {
  const session = await requireApiPermission("settings.users.edit");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { status?: TeamMemberStatus; roleId?: string | null; name?: string };

  const existing = await prisma.teamMember.findFirst({
    where: { id, ownerUserId: session.sub },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status === "INACTIVE" && d.status !== undefined && d.status !== "INACTIVE") {
    const limits = await getPlanLimits(session.sub);
    if (limits?.maxUsers != null) {
      const seats =
        (await prisma.teamMember.count({ where: { ownerUserId: session.sub, status: { not: "INACTIVE" } } })) + 1;
      if (seats >= limits.maxUsers) {
        return NextResponse.json(
          { error: `Your ${limits.name} plan allows ${limits.maxUsers} users. Upgrade to reactivate this user.` },
          { status: 403 },
        );
      }
    }
  }

  await prisma.teamMember.update({
    where: { id },
    data: {
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.roleId !== undefined ? { appRoleId: d.roleId || null } : {}),
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
    },
  });

  await writeAuditLog(session.sub, "UPDATE_USER", "TeamMember", id);

  return NextResponse.json({ ok: true });
}
