import { NextResponse } from "next/server";
import { extractRawTextFromDocument } from "@/lib/ocr/extract-text";
import { resolveOcrUploadMime } from "@/lib/ocr/infer-mime";
import { parseReceiptText } from "@/lib/receipt-ocr";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maximum file size is 10MB" }, { status: 400 });
  }

  const mime = resolveOcrUploadMime(file.name ?? "", file.type || "");
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported for receipt OCR" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const raw = await extractRawTextFromDocument(buffer, mime);
    if (!raw.text || raw.text.length < 8) {
      return NextResponse.json(
        { error: "Could not read text from this image. Try a clearer photo or set GOOGLE_CLOUD_VISION_API_KEY." },
        { status: 422 },
      );
    }
    const parsed = parseReceiptText(raw.text);
    return NextResponse.json({
      parsed,
      rawTextPreview: raw.text.slice(0, 2000),
      engine: raw.engine,
      confidence: raw.confidence,
    });
  } catch (e) {
    console.error("OCR failed", e);
    return NextResponse.json({ error: "Could not read text from this image. Try a clearer photo." }, { status: 422 });
  }
}
