import { NextResponse } from "next/server";
import { parseTemplateConfigJson } from "@/lib/document-template-types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { documentTemplateCreateSchema } from "@/lib/validators";

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
  const displayName = name?.trim() || "Imported template";
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

  return NextResponse.json({ id: created.id }, { status: 201 });
}
