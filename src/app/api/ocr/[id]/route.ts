import { NextResponse } from "next/server";
import type { OcrExtractedDocument } from "@/lib/ocr/types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "ocr");
  if (denied) return denied;
  const { id } = await ctx.params;

  const doc = await prisma.ocrDocument.findFirst({
    where: { id, userId: session.sub },
    select: {
      id: true,
      documentType: true,
      status: true,
      originalName: true,
      rawText: true,
      extractedJson: true,
      confidence: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let extracted: OcrExtractedDocument | null = null;
  if (doc.extractedJson) {
    try {
      extracted = JSON.parse(doc.extractedJson) as OcrExtractedDocument;
    } catch {
      extracted = null;
    }
  }

  return NextResponse.json({
    id: doc.id,
    documentType: doc.documentType,
    status: doc.status,
    originalName: doc.originalName,
    extracted,
    rawTextPreview: doc.rawText?.slice(0, 4000) ?? null,
    confidence: doc.confidence,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
