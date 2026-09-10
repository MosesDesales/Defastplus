import { OCR_ALLOWED_MIMES } from "@/lib/ocr/types";

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Infer MIME from filename when the browser sends an empty or generic type. */
export function inferMimeFromFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

/** Resolve upload MIME: trust browser type when allowed, else sniff from extension. */
export function resolveOcrUploadMime(fileName: string, browserType: string): string {
  const raw = (browserType || "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (raw && (OCR_ALLOWED_MIMES as readonly string[]).includes(raw)) return raw;
  return (inferMimeFromFilename(fileName) ?? raw) || "application/octet-stream";
}
