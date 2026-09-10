import { NextResponse } from "next/server";
import { setTemplateAsDefault } from "@/lib/document-templates-service";
import type { DocumentTemplateTypeSlug } from "@/lib/document-template-types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { templateSetDefaultBodySchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = templateSetDefaultBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await setTemplateAsDefault(prisma, session.sub, id, parsed.data.moduleName as DocumentTemplateTypeSlug);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
