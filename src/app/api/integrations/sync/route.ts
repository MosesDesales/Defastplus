import { IntegrationStatus, IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { requireApiModules } from "@/lib/api-require-module";
import { defaultConfigFor, parseConfigJson } from "@/lib/integrations/default-config";
import { isIntegrationSlug, slugToType } from "@/lib/integrations/slug";
import { appendLog, runIntegrationSync, testTallyConnection } from "@/lib/integrations/sync-engine";

export async function POST(request: Request) {
  const session = await requireApiPermission("settings.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { type?: string; test?: boolean };
  const slug = body.type ?? "";
  if (!isIntegrationSlug(slug)) {
    return NextResponse.json({ error: "Invalid integration type" }, { status: 400 });
  }
  const intType = slugToType(slug)!;

  const denied =
    intType === IntegrationType.TALLY
      ? await requireApiModules(session.sub, "tally")
      : intType === IntegrationType.ZOHO_BOOKS
        ? await requireApiModules(session.sub, "zoho_books")
        : await requireApiModules(session.sub, "quickbooks");
  if (denied) return denied;

  let row = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: intType } },
  });

  if (!row) {
    row = await prisma.integration.create({
      data: {
        userId: session.sub,
        type: intType,
        status: IntegrationStatus.DISCONNECTED,
        configJson: JSON.stringify(defaultConfigFor(intType)),
      },
    });
  }

  if (body.test && intType === IntegrationType.TALLY) {
    const cfg = parseConfigJson(row.configJson, intType);
    const url = cfg.tallyUrl ?? "http://localhost:9000";
    const res = await testTallyConnection(url);
    await appendLog(row.id, "Tally test connection", res.ok ? "SUCCESS" : "FAILED", res.ok ? null : res.message);
    return NextResponse.json({ ok: res.ok, message: res.message, httpStatus: res.status });
  }

  const result = await runIntegrationSync(row);
  return NextResponse.json({ ok: result.ok, message: result.message, detail: result.detail });
}
