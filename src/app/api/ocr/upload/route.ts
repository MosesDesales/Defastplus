import { NextResponse } from "next/server";
import { isAllowedOcrMime, OCR_MAX_BYTES, type OcrDocumentType } from "@/lib/ocr/types";
import { resolveOcrUploadMime } from "@/lib/ocr/infer-mime";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

const ALLOWED_TYPES = new Set<OcrDocumentType>(["INVOICE", "BILL", "EXPENSE"]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "ocr");
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim().toUpperCase();
  if (!ALLOWED_TYPES.has(documentType as OcrDocumentType)) {
    return NextResponse.json({ error: "documentType must be INVOICE, BILL, or EXPENSE" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > OCR_MAX_BYTES) {
    return NextResponse.json({ error: "Maximum file size is 20MB" }, { status: 400 });
  }

  const mime = resolveOcrUploadMime(file.name ?? "", file.type || "");
  if (!isAllowedOcrMime(mime)) {
    return NextResponse.json({ error: "Only PDF, JPG, and PNG are allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const row = await prisma.ocrDocument.create({
    data: {
      userId: session.sub,
      documentType,
      fileMime: mime,
      fileBytes: buffer,
      originalName: file.name?.slice(0, 240) || null,
      status: "PENDING",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
