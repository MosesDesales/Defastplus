/** Server-only: uses `pdf-parse`, `sharp`, `tesseract.js`. Import only from API routes / server code. */

import fs from "node:fs";
import path from "node:path";
import { preprocessIfImage } from "@/lib/ocr/preprocess-image";

export type OcrTextEngine = "google_vision" | "tesseract" | "pdf_parse" | "pdf_ocr";

export type RawTextResult = {
  text: string;
  confidence: number;
  engine: OcrTextEngine;
  preprocessSteps?: string[];
  pageCount?: number;
};

const MIN_USEFUL_TEXT = 40;
const MAX_PDF_OCR_PAGES = 8;

function tesseractWorkerOptions(): { langPath?: string; gzip?: boolean } {
  const langPath = process.cwd();
  const localEng = path.join(langPath, "eng.traineddata");
  if (fs.existsSync(localEng)) {
    return { langPath, gzip: false };
  }
  return {};
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text?: string }>;
  const data = await pdfParse(buffer);
  return (data?.text ?? "").trim();
}

async function rasterizePdfPages(buffer: Buffer, maxPages = MAX_PDF_OCR_PAGES): Promise<Buffer[]> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buffer, { density: 240 }).metadata();
  const pageCount = Math.max(1, meta.pages ?? 1);
  const pages = Math.min(pageCount, maxPages);
  const images: Buffer[] = [];
  for (let page = 0; page < pages; page++) {
    images.push(await sharp(buffer, { density: 240, page }).png().toBuffer());
  }
  return images;
}

async function extractImageWithVision(buffer: Buffer): Promise<RawTextResult> {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
  if (!key) throw new Error("no_vision_key");
  const base64 = buffer.toString("base64");
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        },
      ],
    }),
  });
  const j = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }>;
  };
  const err = j.responses?.[0]?.error;
  if (!res.ok || err) {
    throw new Error(err?.message ?? `Vision HTTP ${res.status}`);
  }
  const text = (j.responses?.[0]?.fullTextAnnotation?.text ?? "").trim();
  const confidence = text.length > 120 ? 0.9 : text.length > 40 ? 0.75 : 0.5;
  return { text, confidence, engine: "google_vision" };
}

async function createOcrWorker() {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, tesseractWorkerOptions());
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  return worker;
}

async function extractImageWithTesseract(buffer: Buffer, worker?: Awaited<ReturnType<typeof createOcrWorker>>): Promise<RawTextResult> {
  const owned = !worker;
  const w = worker ?? (await createOcrWorker());
  try {
    const {
      data: { text, confidence },
    } = await w.recognize(buffer);
    const c =
      typeof confidence === "number" && Number.isFinite(confidence)
        ? Math.min(0.92, Math.max(0.25, confidence / 100))
        : 0.55;
    return { text: (text ?? "").trim(), confidence: c, engine: "tesseract" };
  } finally {
    if (owned) await w.terminate();
  }
}

async function extractImageText(buffer: Buffer, worker?: Awaited<ReturnType<typeof createOcrWorker>>): Promise<RawTextResult> {
  try {
    return await extractImageWithVision(buffer);
  } catch {
    return extractImageWithTesseract(buffer, worker);
  }
}

async function ocrPdfAsImages(buffer: Buffer): Promise<RawTextResult> {
  let pages: Buffer[];
  try {
    pages = await rasterizePdfPages(buffer);
  } catch (e) {
    console.warn("PDF rasterize failed:", e);
    throw new Error(
      "Could not read this PDF. If it is a scan, try uploading a JPG/PNG photo, or set GOOGLE_CLOUD_VISION_API_KEY.",
    );
  }

  const worker = await createOcrWorker();
  const chunks: string[] = [];
  let confidenceSum = 0;
  try {
    for (const page of pages) {
      const pre = await preprocessImageForOcrPage(page);
      const result = await extractImageText(pre.buffer, worker);
      if (result.text) chunks.push(result.text);
      confidenceSum += result.confidence;
    }
  } finally {
    await worker.terminate();
  }

  const text = chunks.join("\n\n--- page break ---\n\n").trim();
  return {
    text,
    confidence: pages.length ? confidenceSum / pages.length : 0.3,
    engine: "pdf_ocr",
    pageCount: pages.length,
    preprocessSteps: ["pdf_rasterize", "per_page_preprocess"],
  };
}

async function preprocessImageForOcrPage(buffer: Buffer) {
  const { preprocessImageForOcr } = await import("@/lib/ocr/preprocess-image");
  return preprocessImageForOcr(buffer);
}

export async function extractRawTextFromDocument(buffer: Buffer, mime: string): Promise<RawTextResult> {
  const head = mime.toLowerCase().split(";")[0]?.trim() ?? "";

  if (head === "application/pdf") {
    const textLayer = await extractPdfText(buffer);
    if (textLayer.length >= MIN_USEFUL_TEXT) {
      return {
        text: textLayer,
        confidence: textLayer.length > 200 ? 0.78 : 0.48,
        engine: "pdf_parse",
        pageCount: 1,
      };
    }
    const ocr = await ocrPdfAsImages(buffer);
    if (ocr.text.length >= 8) return ocr;
    return {
      text: ocr.text || textLayer,
      confidence: Math.min(ocr.confidence, 0.25),
      engine: ocr.text.length > textLayer.length ? "pdf_ocr" : "pdf_parse",
    };
  }

  if (head.startsWith("image/")) {
    const pre = await preprocessIfImage(mime, buffer);
    const result = await extractImageText(pre.buffer);
    return { ...result, preprocessSteps: pre.steps };
  }

  throw new Error(`Unsupported MIME type for OCR: ${mime}`);
}
