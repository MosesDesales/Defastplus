import { NextResponse } from "next/server";
import { parseTemplateConfigJson } from "@/lib/document-template-types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const t = await prisma.documentTemplate.findFirst({
    where: { id, userId: session.sub },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = {
    version: 1 as const,
    type: t.type,
    name: t.name,
    config: parseTemplateConfigJson(t.configJson),
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Disposition": `attachment; filename="template-${t.type}-${t.id.slice(0, 8)}.json"`,
    },
  });
}
