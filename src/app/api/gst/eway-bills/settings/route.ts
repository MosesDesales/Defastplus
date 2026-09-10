import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { encryptEWayCredentials, decryptEWayCredentials, maskCredential } from "@/lib/eway/credentials";
import { getOrCreateEWaySettings } from "@/lib/eway/service";
import { prisma } from "@/lib/prisma";

/** GET /api/gst/eway-bills/settings */
export async function GET() {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const settings = await getOrCreateEWaySettings(session.sub);
  const creds = decryptEWayCredentials(settings.apiCredentialsEnc);

  return NextResponse.json({
    enabled: settings.enabled,
    valueThresholdInr: Number(settings.valueThresholdInr),
    autoSuggestInterstate: settings.autoSuggestInterstate,
    autoSuggestOverThreshold: settings.autoSuggestOverThreshold,
    gspProvider: settings.gspProvider,
    sandboxMode: settings.sandboxMode,
    credentialsConfigured: Boolean(settings.apiCredentialsEnc),
    credentialsPreview: {
      username: maskCredential(creds.username),
      gstin: creds.gstin ?? "",
    },
  });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  valueThresholdInr: z.coerce.number().min(0).optional(),
  autoSuggestInterstate: z.boolean().optional(),
  autoSuggestOverThreshold: z.boolean().optional(),
  gspProvider: z.string().max(50).optional(),
  sandboxMode: z.boolean().optional(),
  credentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      gstin: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
    })
    .optional(),
});

/** PATCH /api/gst/eway-bills/settings */
export async function PATCH(request: Request) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getOrCreateEWaySettings(session.sub);
  let apiCredentialsEnc = existing.apiCredentialsEnc;

  if (parsed.data.credentials) {
    const prev = decryptEWayCredentials(existing.apiCredentialsEnc);
    const merged = { ...prev, ...parsed.data.credentials };
    if (parsed.data.credentials.password === "") delete merged.password;
    apiCredentialsEnc = encryptEWayCredentials(merged);
  }

  const updated = await prisma.eWayBillSettings.update({
    where: { userId: session.sub },
    data: {
      enabled: parsed.data.enabled,
      valueThresholdInr: parsed.data.valueThresholdInr,
      autoSuggestInterstate: parsed.data.autoSuggestInterstate,
      autoSuggestOverThreshold: parsed.data.autoSuggestOverThreshold,
      gspProvider: parsed.data.gspProvider,
      sandboxMode: parsed.data.sandboxMode,
      apiCredentialsEnc,
    },
  });

  return NextResponse.json({
    enabled: updated.enabled,
    valueThresholdInr: Number(updated.valueThresholdInr),
    autoSuggestInterstate: updated.autoSuggestInterstate,
    autoSuggestOverThreshold: updated.autoSuggestOverThreshold,
    gspProvider: updated.gspProvider,
    sandboxMode: updated.sandboxMode,
    credentialsConfigured: Boolean(updated.apiCredentialsEnc),
  });
}
