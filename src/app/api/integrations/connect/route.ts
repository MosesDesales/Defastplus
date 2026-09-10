import { IntegrationStatus, IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { requireApiModules } from "@/lib/api-require-module";
import { encryptCredentials } from "@/lib/integrations/crypto-credentials";
import { defaultConfigFor, parseConfigJson, parseMappingJson } from "@/lib/integrations/default-config";
import { isIntegrationSlug, slugToType } from "@/lib/integrations/slug";

export async function POST(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as {
    type?: string;
    action?: "connect" | "disconnect";
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
    mapping?: { accounts: { app: string; external: string }[]; taxRates: { app: string; external: string }[]; items: { app: string; external: string }[] };
  };

  const slug = body.type ?? "";
  if (!isIntegrationSlug(slug)) {
    return NextResponse.json({ error: "Invalid integration type" }, { status: 400 });
  }
  const intType = slugToType(slug)!;
  const disconnect = body.action === "disconnect";

  const existing = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: intType } },
  });

  const baseConfig = parseConfigJson(existing?.configJson ?? null, intType);
  const mergedConfig = {
    ...baseConfig,
    ...(body.config ?? {}),
    scopes: { ...baseConfig.scopes, ...((body.config as { scopes?: typeof baseConfig.scopes })?.scopes ?? {}) },
  };

  if (disconnect) {
    const row = await prisma.integration.upsert({
      where: { userId_type: { userId: session.sub, type: intType } },
      create: {
        userId: session.sub,
        type: intType,
        status: IntegrationStatus.DISCONNECTED,
        configJson: JSON.stringify(mergedConfig),
        credentialsEncrypted: null,
      },
      update: {
        status: IntegrationStatus.DISCONNECTED,
        credentialsEncrypted: null,
        configJson: JSON.stringify(mergedConfig),
      },
    });
    return NextResponse.json({ ok: true, integration: { id: row.id, status: row.status } });
  }

  const denied =
    intType === IntegrationType.TALLY
      ? await requireApiModules(session.sub, "tally")
      : intType === IntegrationType.ZOHO_BOOKS
        ? await requireApiModules(session.sub, "zoho_books")
        : await requireApiModules(session.sub, "quickbooks");
  if (denied) return denied;

  let credentialsEnc: string | null = null;
  const cred = { ...(body.credentials ?? {}) };
  if (Object.keys(cred).length > 0) {
    try {
      credentialsEnc = encryptCredentials(cred);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Encryption failed" },
        { status: 500 },
      );
    }
  } else if (existing?.credentialsEncrypted) {
    credentialsEnc = existing.credentialsEncrypted;
  }

  if (intType === IntegrationType.ZOHO_BOOKS) {
    const cid = String(cred.clientId ?? "").trim();
    const cs = String(cred.clientSecret ?? "").trim();
    if (!cid || !cs) {
      return NextResponse.json({ error: "Zoho Books requires Client ID and Client Secret to connect." }, { status: 400 });
    }
  }

  if (intType === IntegrationType.QUICKBOOKS) {
    const cid = String(cred.clientId ?? "").trim();
    const cs = String(cred.clientSecret ?? "").trim();
    if (!cid || !cs) {
      return NextResponse.json({ error: "QuickBooks requires Client ID and Client Secret to connect." }, { status: 400 });
    }
  }

  const mappingJson = JSON.stringify(body.mapping ?? parseMappingJson(existing?.mappingJson ?? null));

  const row = await prisma.integration.upsert({
    where: { userId_type: { userId: session.sub, type: intType } },
    create: {
      userId: session.sub,
      type: intType,
      status: IntegrationStatus.CONNECTED,
      credentialsEncrypted: credentialsEnc,
      configJson: JSON.stringify({ ...defaultConfigFor(intType), ...mergedConfig }),
      mappingJson,
    },
    update: {
      status: IntegrationStatus.CONNECTED,
      ...(credentialsEnc !== null ? { credentialsEncrypted: credentialsEnc } : {}),
      configJson: JSON.stringify(mergedConfig),
      mappingJson,
    },
  });

  return NextResponse.json({ ok: true, integration: { id: row.id, status: row.status } });
}
