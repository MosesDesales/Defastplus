import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { seedDefaultAppRoles } from "@/lib/settings/seed-roles";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireApiPermission("settings.roles.view");
  if (session instanceof NextResponse) return session;

  let rows = await prisma.appRole.findMany({
    where: { userId: session.sub },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  if (rows.length === 0) {
    await seedDefaultAppRoles(session.sub);
    rows = await prisma.appRole.findMany({
      where: { userId: session.sub },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  return NextResponse.json({
    roles: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      permissions: r.permissions,
      isSystem: r.isSystem,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireApiPermission("settings.roles.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = json as { name?: string; slug?: string; permissions?: string[] };
  const name = d.name?.trim();
  const slug = d.slug?.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name || !slug) return NextResponse.json({ error: "Name and slug required" }, { status: 400 });
  const perms = Array.isArray(d.permissions) ? d.permissions : [];

  const row = await prisma.appRole.create({
    data: {
      userId: session.sub,
      name,
      slug,
      permissions: perms as unknown as Prisma.InputJsonValue,
      isSystem: false,
    },
  });

  await writeAuditLog(session.sub, "CREATE_ROLE", "AppRole", row.id);

  return NextResponse.json({ role: { id: row.id } }, { status: 201 });
}
