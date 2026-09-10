import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit } from "@/lib/ocr/audit-log";
import { attachDuplicateHints } from "@/lib/ocr/duplicate-check";
import { buildFieldConfidence } from "@/lib/ocr/field-confidence";
import { extractRawTextFromDocument } from "@/lib/ocr/extract-text";
import { validateGstinFull } from "@/lib/ocr/gst-validation";
import { buildStructuredExtraction } from "@/lib/ocr/structured-from-text";
import type { OcrDocumentType, OcrExtractedDocument } from "@/lib/ocr/types";
import { loadVendorTemplate, recordVendorTemplateSuccess } from "@/lib/ocr/vendor-templates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  const started = Date.now();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "ocr");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const doc = await prisma.ocrDocument.findFirst({
    where: { id: parsed.data.id, userId: session.sub },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let auditLog = appendAudit(undefined, "start", "OCR processing started", doc.originalName ?? doc.fileMime);

  await prisma.ocrDocument.update({
    where: { id: doc.id },
    data: { status: "PROCESSING", errorMessage: null },
  });

  const buffer = Buffer.from(doc.fileBytes);
  const docType = doc.documentType as OcrDocumentType;

  try {
    const raw = await extractRawTextFromDocument(buffer, doc.fileMime);
    auditLog = appendAudit(
      auditLog,
      "extract",
      `Text extracted via ${raw.engine}`,
      `${raw.text.length} chars · ${Date.now() - started}ms`,
    );

    if (!raw.text || raw.text.length < 8) {
      throw new Error(
        doc.fileMime === "application/pdf"
          ? "Could not read enough text from this PDF (scan or image-only). Try a JPG/PNG photo or set GOOGLE_CLOUD_VISION_API_KEY."
          : "Very little text extracted. Try a sharper image or enable Google Vision.",
      );
    }

    const company = await prisma.companyProfile.findUnique({
      where: { userId: session.sub },
      select: { gstin: true },
    });

    let extracted: OcrExtractedDocument = await buildStructuredExtraction(
      raw.text,
      docType,
      company?.gstin ?? null,
      raw.confidence,
      raw.engine,
    );

    const vendorTemplate = await loadVendorTemplate(prisma, session.sub, extracted);
    if (vendorTemplate) {
      extracted.meta = {
        ...extracted.meta,
        vendorTemplateId: vendorTemplate.id,
        parseMode: extracted.meta?.parseMode ?? "vendor_template",
      };
      auditLog = appendAudit(auditLog, "template", "Matched vendor layout template", vendorTemplate.id);
    }

    extracted = await attachDuplicateHints(session.sub, docType, extracted);

    const gstinValid = extracted.partyGstin ? validateGstinFull(extracted.partyGstin).valid : true;
    extracted.fieldConfidence = buildFieldConfidence(extracted, raw.confidence, {
      gstinValid,
      totalsReconciled: !extracted.meta?.validationNotes?.some((n) => n.includes("mismatch")),
    });
    extracted.confidence = Math.min(
      0.95,
      (extracted.confidence ?? raw.confidence) *
        (Object.values(extracted.fieldConfidence ?? {}).filter((v) => v != null && v > 0).length > 3 ? 0.98 : 0.9),
    );
    extracted.meta = {
      ...extracted.meta,
      preprocessSteps: raw.preprocessSteps,
      pageCount: raw.pageCount,
      auditLog,
    };

    await recordVendorTemplateSuccess(prisma, session.sub, extracted, raw.text).catch(() => undefined);

    await prisma.ocrDocument.update({
      where: { id: doc.id },
      data: {
        status: "DONE",
        rawText: raw.text.slice(0, 200_000),
        extractedJson: JSON.stringify(extracted),
        fieldConfidenceJson: JSON.stringify(extracted.fieldConfidence ?? {}),
        auditLogJson: JSON.stringify(auditLog),
        confidence: extracted.confidence ?? raw.confidence,
        errorMessage: null,
      },
    });

    auditLog = appendAudit(auditLog, "done", "OCR completed", `${Date.now() - started}ms total`);

    return NextResponse.json({
      id: doc.id,
      extracted,
      rawTextPreview: raw.text.slice(0, 4000),
      confidence: extracted.confidence ?? raw.confidence,
      fieldConfidence: extracted.fieldConfidence,
      engine: raw.engine,
      processingMs: Date.now() - started,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR failed";
    auditLog = appendAudit(auditLog, "error", msg);
    await prisma.ocrDocument.update({
      where: { id: doc.id },
      data: {
        status: "FAILED",
        errorMessage: msg.slice(0, 2000),
        auditLogJson: JSON.stringify(auditLog),
      },
    });
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
