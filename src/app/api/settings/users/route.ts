import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { getPlanLimits } from "@/lib/superadmin/service";

/** GET / POST team roster (invite-style users — no separate login in MVP). */
export async function GET() {
  const session = await requireApiPermission("settings.users.view");
  if (session instanceof NextResponse) return session;

  const rows = await prisma.teamMember.findMany({
    where: { ownerUserId: session.sub },
    include: { appRole: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      roleId: u.appRoleId,
      roleName: u.appRole?.name ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("settings.users.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { email?: string; name?: string; roleId?: string | null };
  const email = d.email?.trim().toLowerCase();
  const name = d.name?.trim();
  if (!email || !name) return NextResponse.json({ error: "Email and name required" }, { status: 400 });

  const limits = await getPlanLimits(session.sub);
  if (limits?.maxUsers != null) {
    const seats =
      (await prisma.teamMember.count({ where: { ownerUserId: session.sub, status: { not: "INACTIVE" } } })) + 1;
    if (seats >= limits.maxUsers) {
      return NextResponse.json(
        { error: `Your ${limits.name} plan allows ${limits.maxUsers} user${limits.maxUsers === 1 ? "" : "s"}. Upgrade to add more.` },
        { status: 403 },
      );
    }
  }

  const row = await prisma.teamMember.create({
    data: {
      ownerUserId: session.sub,
      email,
      name,
      appRoleId: d.roleId?.trim() || null,
      status: "INVITED",
    },
  });

  await writeAuditLog(session.sub, "INVITE_USER", "TeamMember", row.id, { email });

  return NextResponse.json(
    {
      user: { id: row.id },
      invite: { note: "Invite email not configured — user appears as INVITED in roster." },
    },
    { status: 201 },
  );
}
