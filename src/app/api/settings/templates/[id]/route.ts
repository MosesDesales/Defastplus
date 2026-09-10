import { NextResponse } from "next/server";
import { parseTemplateConfigJson } from "@/lib/document-template-types";
import { canDeleteTemplate, ensureDefaultTemplatesForUser } from "@/lib/document-templates-service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { documentTemplatePatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const t = await prisma.documentTemplate.findFirst({
    where: { id, userId: session.sub },
    include: { moduleMaps: { select: { moduleName: true } } },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const moduleNames = t.moduleMaps.length > 0 ? t.moduleMaps.map((m) => m.moduleName) : [t.type];

  return NextResponse.json({
    id: t.id,
    type: t.type,
    name: t.name,
    isDefault: t.isDefault,
    moduleNames,
    config: parseTemplateConfigJson(t.configJson),
    exportFileNamePattern: t.exportFileNamePattern,
    thumbnailUrl: t.thumbnailUrl,
    updatedAt: t.updatedAt.toISOString(),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.documentTemplate.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = documentTemplatePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;
  const configJson =
    patch.config !== undefined
      ? JSON.stringify(parseTemplateConfigJson(JSON.stringify(patch.config)))
      : undefined;

  await prisma.$transaction(async (tx) => {
    if (patch.moduleNames !== undefined) {
      const unique = [...new Set(patch.moduleNames)];
      await tx.documentTemplateModuleMap.deleteMany({ where: { templateId: id } });
      await tx.documentTemplateModuleMap.createMany({
        data: unique.map((moduleName) => ({ templateId: id, moduleName })),
      });
      await tx.userDocumentTemplateDefault.deleteMany({
        where: {
          userId: session.sub,
          templateId: id,
          moduleName: { notIn: unique },
        },
      });
    }

    await tx.documentTemplate.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(configJson !== undefined ? { configJson } : {}),
        ...(patch.exportFileNamePattern !== undefined
          ? { exportFileNamePattern: patch.exportFileNamePattern }
          : {}),
        ...(patch.thumbnailUrl !== undefined ? { thumbnailUrl: patch.thumbnailUrl } : {}),
      },
    });
  });

  await ensureDefaultTemplatesForUser(prisma, session.sub);

  const updated = await prisma.documentTemplate.findFirst({
    where: { id },
    include: { moduleMaps: { select: { moduleName: true } } },
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    isDefault: updated.isDefault,
    moduleNames: updated.moduleMaps.map((m) => m.moduleName),
    config: parseTemplateConfigJson(updated.configJson),
    exportFileNamePattern: updated.exportFileNamePattern,
    thumbnailUrl: updated.thumbnailUrl,
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const gate = await canDeleteTemplate(prisma, session.sub, id);
  if (!gate.ok) {
    if (gate.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (gate.reason === "default_for_module") {
      return NextResponse.json(
        {
          error:
            "This template is set as the default for one or more modules. Choose another default before deleting.",
        },
        { status: 400 },
      );
    }
    if (gate.reason === "last_for_module") {
      return NextResponse.json(
        {
          error: `You must keep at least one template mapped to “${gate.moduleName ?? "this module"}”.`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Cannot delete this template." }, { status: 400 });
  }

  await prisma.documentTemplate.delete({ where: { id } });
  await ensureDefaultTemplatesForUser(prisma, session.sub);

  return NextResponse.json({ ok: true });
}
