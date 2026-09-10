import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationSettingsRow } from "@/lib/organization-settings-db";
import { getSession } from "@/lib/session";
import { templateWorkspaceExportSchema } from "@/lib/validators";

const DEFAULT_PATTERN = "{type}-{number}";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await getOrCreateOrganizationSettingsRow(session.sub);
  return NextResponse.json({
    defaultPdfExportFilenamePattern: row.defaultPdfExportFilenamePattern ?? DEFAULT_PATTERN,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = templateWorkspaceExportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.organizationSettings.upsert({
    where: { userId: session.sub },
    create: {
      userId: session.sub,
      defaultPdfExportFilenamePattern: parsed.data.defaultPdfExportFilenamePattern,
    },
    update: { defaultPdfExportFilenamePattern: parsed.data.defaultPdfExportFilenamePattern },
  });

  return NextResponse.json({ ok: true });
}
