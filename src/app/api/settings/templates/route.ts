import { NextResponse } from "next/server";
import { isDocumentTemplateTypeSlug, parseTemplateConfigJson } from "@/lib/document-template-types";
import { ensureDefaultTemplatesForUser, listTemplatesForModule } from "@/lib/document-templates-service";
import { getOrCreateOrganizationSettingsRow } from "@/lib/organization-settings-db";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { documentTemplateCreateSchema } from "@/lib/validators";

const DEFAULT_PATTERN = "{type}-{number}";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  if (url.searchParams.get("all") === "1") {
    await ensureDefaultTemplatesForUser(prisma, session.sub);
    const templates = await prisma.documentTemplate.findMany({
      where: { userId: session.sub },
      select: { id: true, name: true, type: true },
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json({ templates });
  }

  const mod = (url.searchParams.get("module") ?? url.searchParams.get("type"))?.trim() ?? "";
  if (!mod || !isDocumentTemplateTypeSlug(mod)) {
    return NextResponse.json(
      { error: "Query ?module= (or ?type=) is required, or use ?all=1 for a compact list." },
      { status: 400 },
    );
  }

  const rows = await listTemplatesForModule(prisma, session.sub, mod);
  const org = await getOrCreateOrganizationSettingsRow(session.sub);

  return NextResponse.json({
    module: mod,
    templates: rows.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      isDefault: t.isDefault,
      isDefaultForModule: t.isDefaultForModule,
      configJson: t.configJson,
      thumbnailUrl: t.thumbnailUrl,
      exportFileNamePattern: t.exportFileNamePattern,
      updatedAt: t.updatedAt.toISOString(),
      moduleNames: t.moduleNames,
    })),
    workspaceDefaultExportPattern: org.defaultPdfExportFilenamePattern ?? DEFAULT_PATTERN,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = documentTemplateCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { type, name, config, moduleNames: rawModules } = parsed.data;
  const cfgJson = JSON.stringify(parseTemplateConfigJson(JSON.stringify(config ?? {})));
  const displayName = name?.trim() || "Untitled";
  const modules = rawModules?.length ? [...new Set(rawModules)] : [type];

  const created = await prisma.documentTemplate.create({
    data: {
      userId: session.sub,
      type,
      name: displayName,
      isDefault: false,
      configJson: cfgJson,
      moduleMaps: { create: modules.map((moduleName) => ({ moduleName })) },
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      type: created.type,
      isDefault: created.isDefault,
      moduleNames: modules,
    },
    { status: 201 },
  );
}
