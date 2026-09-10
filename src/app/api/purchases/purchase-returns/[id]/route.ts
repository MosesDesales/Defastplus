import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const ret = await prisma.purchaseReturn.findFirst({
    where: { id, userId: session.sub },
    include: {
      vendor: true,
      lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!ret) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ret);
}
