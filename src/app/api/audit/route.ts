import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10) || 50, 200);

  const rows = await prisma.auditLog.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({
    logs: rows.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      meta: l.meta,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
