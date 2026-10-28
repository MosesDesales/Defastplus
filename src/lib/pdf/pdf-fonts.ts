import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type PdfFonts = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  /** "₹" when the embedded font has the glyph; the standard PDF fonts do not. */
  rupee: string;
};

/** Inter (SIL OFL 1.1) — see fonts/Inter-OFL-LICENSE.txt. */
const FONT_DIR = join(process.cwd(), "src", "lib", "pdf", "fonts");
const FILES = {
  regular: "Inter-Regular.ttf",
  medium: "Inter-Medium.ttf",
  semibold: "Inter-SemiBold.ttf",
  bold: "Inter-Bold.ttf",
} as const;

let cache: Record<keyof typeof FILES, Buffer> | null | undefined;

function loadFontFiles() {
  if (cache !== undefined) return cache;
  try {
    const out = {} as Record<keyof typeof FILES, Buffer>;
    for (const [k, f] of Object.entries(FILES) as [keyof typeof FILES, string][]) {
      const p = join(FONT_DIR, f);
      if (!existsSync(p)) throw new Error(`missing ${p}`);
      out[k] = readFileSync(p);
    }
    cache = out;
  } catch (e) {
    console.warn("[pdf] Inter fonts unavailable, falling back to Helvetica:", (e as Error).message);
    cache = null;
  }
  return cache;
}

/** Registers the document fonts; falls back to the built-in Helvetica family. */
export function registerPdfFonts(doc: PdfDoc): PdfFonts {
  const files = loadFontFiles();
  if (!files) {
    return { regular: "Helvetica", medium: "Helvetica", semibold: "Helvetica-Bold", bold: "Helvetica-Bold", rupee: "Rs." };
  }
  doc.registerFont("Inter", files.regular);
  doc.registerFont("Inter-Medium", files.medium);
  doc.registerFont("Inter-SemiBold", files.semibold);
  doc.registerFont("Inter-Bold", files.bold);
  return { regular: "Inter", medium: "Inter-Medium", semibold: "Inter-SemiBold", bold: "Inter-Bold", rupee: "₹" };
}
