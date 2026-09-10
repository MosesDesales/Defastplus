import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { isIntegrationSlug, slugToType } from "@/lib/integrations/slug";

export async function GET(request: Request) {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("type") ?? "";
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "40", 10) || 40));

  if (!isIntegrationSlug(slug)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const intType = slugToType(slug)!;

  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: intType } },
  });
  if (!integration) {
    return NextResponse.json({ logs: [] });
  }

  const logs = await prisma.syncLog.findMany({
    where: { integrationId: integration.id },
    orderBy: { syncedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      module: l.module,
      status: l.status,
      errorMessage: l.errorMessage,
      syncedAt: l.syncedAt.toISOString(),
    })),
  });
}
