import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const src = await prisma.documentTemplate.findFirst({
    where: { id, userId: session.sub },
    include: { moduleMaps: true },
  });
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = src.name.replace(/\s+\(copy(?: \d+)?\)\s*$/i, "").trim() || src.name;
  const mapModules = src.moduleMaps.length > 0 ? src.moduleMaps.map((m) => m.moduleName) : [src.type];

  const dup = await prisma.documentTemplate.create({
    data: {
      userId: session.sub,
      type: src.type,
      name: `${base} (copy)`,
      isDefault: false,
      configJson: src.configJson,
      exportFileNamePattern: src.exportFileNamePattern,
      thumbnailUrl: src.thumbnailUrl,
      moduleMaps: { createMany: { data: [...new Set(mapModules)].map((moduleName) => ({ moduleName })) } },
    },
  });

  return NextResponse.json({ id: dup.id, name: dup.name }, { status: 201 });
}
