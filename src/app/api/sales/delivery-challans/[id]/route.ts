import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "delivery_challan");
  if (denied) return denied;

  const { id } = await ctx.params;
  const challan = await prisma.deliveryChallan.findFirst({
    where: { id, userId: session.sub },
    include: {
      customer: true,
      lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!challan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(challan);
}
