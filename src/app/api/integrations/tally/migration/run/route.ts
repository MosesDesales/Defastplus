import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationType } from "@prisma/client";
import { requireApiModules } from "@/lib/api-require-module";
import { prisma } from "@/lib/prisma";
import { parseConfigJson } from "@/lib/integrations/default-config";
import {
  createMigrationJob,
  fetchFromTallyBridge,
  runMigrationJob,
} from "@/lib/tally/migration-service";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  source: z.enum(["xml_upload", "tally_api"]),
  phases: z
    .object({
      coa: z.boolean().optional(),
      vouchers: z.boolean().optional(),
      inventory: z.boolean().optional(),
      reconcile: z.boolean().optional(),
    })
    .optional(),
});

/** POST /api/integrations/tally/migration/run — run from uploaded body or Tally bridge */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tally");
  if (denied) return denied;

  const contentType = request.headers.get("content-type") ?? "";
  let xml = "";
  let sourceType = "xml_upload";
  let fileName: string | undefined;
  let phases: z.infer<typeof bodySchema>["phases"];

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "XML file required" }, { status: 400 });
    xml = await file.text();
    fileName = file.name;
    sourceType = "xml_upload";
    const phasesRaw = form.get("phases");
    if (typeof phasesRaw === "string" && phasesRaw.trim()) {
      try {
        phases = JSON.parse(phasesRaw) as z.infer<typeof bodySchema>["phases"];
      } catch {
        /* use defaults */
      }
    }
  } else {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    sourceType = parsed.data.source;
    phases = parsed.data.phases;

    if (sourceType === "tally_api") {
      const integration = await prisma.integration.findUnique({
        where: { userId_type: { userId: session.sub, type: IntegrationType.TALLY } },
      });
      const config = parseConfigJson(integration?.configJson ?? null, IntegrationType.TALLY);
      const url = config.tallyUrl ?? "http://localhost:9000";
      try {
        xml = await fetchFromTallyBridge(session.sub, url);
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Tally export failed" }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: "Use multipart upload for xml_upload source" }, { status: 400 });
    }
  }

  if (!xml.trim()) return NextResponse.json({ error: "Empty XML" }, { status: 400 });

  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId: session.sub, type: IntegrationType.TALLY } },
  });

  const job = await createMigrationJob({
    userId: session.sub,
    integrationId: integration?.id,
    sourceType,
    fileName,
    phases,
  });

  try {
    const result = await runMigrationJob(job.id, xml);
    return NextResponse.json({ jobId: job.id, ...result }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { jobId: job.id, error: e instanceof Error ? e.message : "Migration failed" },
      { status: 500 },
    );
  }
}
