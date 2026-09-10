import { IntegrationStatus, IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { requireApiModules } from "@/lib/api-require-module";
import { defaultConfigFor, parseConfigJson, parseMappingJson } from "@/lib/integrations/default-config";
import { isIntegrationSlug, slugToType } from "@/lib/integrations/slug";

type Ctx = { params: Promise<{ type: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireApiPermission("settings.view");
  if (session instanceof NextResponse) return session;

  const { type: slug } = await ctx.params;
  if (!isIntegrationSlug(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const intType = slugToType(slug)!;

  const denied =
    intType === IntegrationType.TALLY
      ? await requireApiModules(session.sub, "tally")
      : intType === IntegrationType.ZOHO_BOOKS
        ? await requireApiModules(session.sub, "zoho_books")
        : await requireApiModules(session.sub, "quickbooks");
  if (denied) return denied;

  const row = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: intType } },
  });

  const config = parseConfigJson(row?.configJson ?? null, intType);
  const mapping = parseMappingJson(row?.mappingJson ?? null);

  return NextResponse.json({
    integration: row
      ? {
          id: row.id,
          type: row.type,
          status: row.status,
          lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
          autoSync: row.autoSync,
          config,
          mapping,
        }
      : {
          id: null,
          type: intType,
          status: IntegrationStatus.DISCONNECTED,
          lastSyncAt: null,
          autoSync: false,
          config: defaultConfigFor(intType),
          mapping: parseMappingJson(null),
        },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  const { type: slug } = await ctx.params;
  if (!isIntegrationSlug(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const intType = slugToType(slug)!;

  const denied =
    intType === IntegrationType.TALLY
      ? await requireApiModules(session.sub, "tally")
      : intType === IntegrationType.ZOHO_BOOKS
        ? await requireApiModules(session.sub, "zoho_books")
        : await requireApiModules(session.sub, "quickbooks");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as {
    config?: Record<string, unknown>;
    mapping?: ReturnType<typeof parseMappingJson>;
    autoSync?: boolean;
  };

  const existing = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: intType } },
  });

  const baseConfig = parseConfigJson(existing?.configJson ?? null, intType);
  const mergedConfig = {
    ...baseConfig,
    ...(body.config ?? {}),
    scopes: {
      ...baseConfig.scopes,
      ...((body.config as { scopes?: typeof baseConfig.scopes })?.scopes ?? {}),
    },
  };

  const mappingJson = body.mapping != null ? JSON.stringify(body.mapping) : existing?.mappingJson ?? null;

  const row = await prisma.integration.upsert({
    where: { userId_type: { userId: session.sub, type: intType } },
    create: {
      userId: session.sub,
      type: intType,
      status: IntegrationStatus.DISCONNECTED,
      configJson: JSON.stringify(mergedConfig),
      mappingJson: mappingJson ?? JSON.stringify(parseMappingJson(null)),
      autoSync: body.autoSync ?? false,
    },
    update: {
      configJson: JSON.stringify(mergedConfig),
      ...(mappingJson != null ? { mappingJson } : {}),
      ...(body.autoSync !== undefined ? { autoSync: body.autoSync } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    integration: {
      id: row.id,
      status: row.status,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      autoSync: row.autoSync,
      config: parseConfigJson(row.configJson, intType),
      mapping: parseMappingJson(row.mappingJson),
    },
  });
}
