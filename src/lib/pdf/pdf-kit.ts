/**
 * Shared building blocks for every FASTPLUS PDF: A4 geometry, fonts (Inter with ₹),
 * logo loading, text helpers, the repeated continuation header, and page chrome
 * (accent bars, footer with page numbers, watermark) stamped on every page.
 */
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { logoBufferFromUrl } from "@/lib/pdf/logo-image-buffer";
import { registerPdfFonts, type PdfFonts } from "@/lib/pdf/pdf-fonts";

export type PdfDoc = InstanceType<typeof PDFDocument>;

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const M = 36;
export const CONTENT_W = PAGE_W - 2 * M;
export const RIGHT = PAGE_W - M;
/** Body starts here on continuation pages (below the repeated header). */
export const CONT_TOP = 80;
/** Reserved for the footer on every page. */
export const BOTTOM = 62;
export const BODY_LIMIT = PAGE_H - BOTTOM - 6;

export type KitTheme = {
  primary: string;
  primaryDark: string;
  soft: string;
  tableHead: string;
  tableBorder: string;
  text: string;
  muted: string;
  line: string;
  stripe: string;
};

export const DEFAULT_COLORS = { primary: "#0f766e", soft: "#f0fdfa", tableHead: "#ccfbf1", tableBorder: "#99f6e4" };

export function darkenHex(hex: string, factor = 0.78): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#115e59";
  const n = parseInt(m[1]!, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * factor));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function makeTheme(c: { primary: string; soft: string; tableHead: string; tableBorder: string } = DEFAULT_COLORS): KitTheme {
  return {
    primary: c.primary,
    primaryDark: darkenHex(c.primary),
    soft: c.soft,
    tableHead: c.tableHead,
    tableBorder: c.tableBorder,
    text: "#0f172a",
    muted: "#64748b",
    line: "#e2e8f0",
    stripe: "#f8fafc",
  };
}

export type Logo = { buf: Buffer; w: number; h: number };

/** Normalises a stored logo (PNG/JPEG data URL or URL) to a trimmed, size-capped PNG. */
export async function loadLogo(url: string | null | undefined): Promise<Logo | null> {
  const raw = await logoBufferFromUrl(url);
  if (!raw) return null;
  try {
    let img = sharp(raw);
    try {
      // Trim uniform borders (white or transparent padding) so the artwork fills the logo box.
      img = sharp(await sharp(raw).trim({ threshold: 12 }).toBuffer());
    } catch {
      /* fully uniform image — keep as is */
    }
    const { data, info } = await img
      .resize({ width: 600, height: 300, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { buf: data, w: info.width, h: info.height };
  } catch {
    return null;
  }
}

export function fitBox(logo: Logo, maxW: number, maxH: number) {
  const s = Math.min(maxW / logo.w, maxH / logo.h);
  return { w: logo.w * s, h: logo.h * s };
}

export const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtQty = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

/** Builds a buffered A4 document; `render` draws into it and the promise resolves with the bytes. */
export function renderPdf(info: { Title: string; Author?: string; Subject?: string }, render: (doc: PdfDoc, F: PdfFonts) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: CONT_TOP, bottom: BOTTOM, left: M, right: M },
      bufferPages: true,
      // PDFKit throws on undefined info values (e.g. no Subject for an expense without a vendor).
      info: Object.fromEntries(Object.entries(info).filter(([, v]) => v != null && v !== "")) as typeof info,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      render(doc, registerPdfFonts(doc));
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export type PutOptions = {
  font?: string;
  size?: number;
  color?: string;
  width?: number;
  align?: "left" | "right" | "center";
  spacing?: number;
  oneLine?: boolean;
  lineGap?: number;
};

export type Writer = ReturnType<typeof makeWriter>;

/** Text/line helpers bound to a document, its fonts and theme. `put` returns the y below the text. */
export function makeWriter(doc: PdfDoc, F: PdfFonts, T: KitTheme, baseSize = 9) {
  const put = (str: string, x: number, y: number, o: PutOptions = {}) => {
    const size = o.size ?? baseSize;
    doc.font(o.font ?? F.regular).fontSize(size).fillColor(o.color ?? T.text);
    doc.text(str, x, y, {
      width: o.width,
      align: o.align ?? "left",
      characterSpacing: o.spacing ?? 0,
      lineGap: o.lineGap ?? 1,
      // Tabular digits keep amount columns aligned; letters/hyphens keep normal spacing.
      ...(/\d/.test(str) && !/[A-Za-z-]/.test(str) ? { features: ["tnum" as const] } : {}),
      ...(o.oneLine ? { height: size * 1.35, ellipsis: true } : {}),
    });
    return doc.y;
  };
  const measure = (str: string, font: string, size: number, width: number, lineGap = 1) =>
    doc.font(font).fontSize(size).heightOfString(str, { width, lineGap });
  const hline = (x1: number, x2: number, y: number, color = T.line, w = 0.6) =>
    doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke().restore();
  const label = (str: string, x: number, y: number, width?: number, align: "left" | "right" = "left") =>
    put(str.toUpperCase(), x, y, { font: F.semibold, size: 6.8, color: T.primary, spacing: 0.7, width, align });
  /** Moves to a new page when `needed` points don't fit; returns the y to continue at. */
  const ensureSpace = (y: number, needed: number) => {
    if (y + needed <= BODY_LIMIT) return y;
    doc.addPage();
    return CONT_TOP;
  };
  return { put, measure, hline, label, ensureSpace, F, T };
}

/** Repeats a compact brand header (logo, company, document title/number) on every page after the first. */
export function installContinuationHeader(
  doc: PdfDoc,
  w: Writer,
  opts: { logo: Logo | null; companyName: string; gstin: string | null; title: string; number: string },
) {
  const draw = () => {
    let x = M;
    if (opts.logo) {
      const b = fitBox(opts.logo, 96, 34);
      doc.image(opts.logo.buf, M, 20 + (34 - b.h) / 2, { width: b.w, height: b.h });
      x = M + b.w + 10;
    }
    w.put(opts.companyName, x, 24, { font: w.F.bold, size: 10.5, width: 300, oneLine: true });
    if (opts.gstin) w.put(`GSTIN ${opts.gstin}`, x, 39, { size: 7.5, color: w.T.muted, width: 300, oneLine: true });
    w.put(opts.title, RIGHT - 220, 24, { font: w.F.bold, size: 10.5, color: w.T.primary, width: 220, align: "right", spacing: 0.5 });
    w.put(`${opts.number} · continued`, RIGHT - 220, 39, { size: 7.5, color: w.T.muted, width: 220, align: "right" });
    w.hline(M, RIGHT, 62, w.T.line, 0.8);
    doc.x = M;
    doc.y = CONT_TOP;
  };
  doc.on("pageAdded", draw);
  return () => doc.removeListener("pageAdded", draw);
}

/** Accent bars, footer (identity · note · page X of Y) and optional watermark on every buffered page. */
export function stampPageChrome(
  doc: PdfDoc,
  w: Writer,
  opts: { identity: string; footerNote: string; reference: string; watermark?: string | null },
) {
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // footer text sits inside the bottom margin

    doc.save().rect(0, 0, PAGE_W, 5).fill(w.T.primary).restore();
    doc.save().rect(0, PAGE_H - 5, PAGE_W, 5).fill(w.T.primary).restore();

    const fy = PAGE_H - 40;
    w.hline(M, RIGHT, fy - 8, w.T.line, 0.6);
    w.put(opts.identity, M, fy, { font: w.F.medium, size: 7, color: w.T.muted, width: 230, oneLine: true });
    w.put(opts.footerNote, M + 230, fy, { size: 7, color: w.T.muted, width: CONTENT_W - 230 - 150, align: "center", oneLine: true });
    w.put(`${opts.reference}  ·  Page ${p - range.start + 1} of ${range.count}`, RIGHT - 150, fy, {
      font: w.F.medium,
      size: 7,
      color: w.T.muted,
      width: 150,
      align: "right",
      oneLine: true,
    });

    if (opts.watermark) {
      doc.save();
      doc.rotate(-32, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font(w.F.bold).fontSize(120).fillColor(w.T.primary).fillOpacity(0.06);
      doc.text(opts.watermark, 0, PAGE_H / 2 - 70, { width: PAGE_W, align: "center", lineBreak: false });
      doc.restore();
    }
    doc.page.margins.bottom = savedBottom;
  }
}

/**
 * Page-1 brand block: logo + company identity on the left, a right-hand block drawn by
 * `right(x, width, top)`. Returns the y below the header divider.
 */
export function drawBrandHeader(
  doc: PdfDoc,
  w: Writer,
  opts: {
    logo: Logo | null;
    company: { name: string; legalName: string | null; addressLines: string[]; gstin: string | null; pan: string | null; contact: string | null };
    nameSize?: number;
    show?: { name?: boolean; address?: boolean; ids?: boolean };
    right: (x: number, width: number, top: number) => number;
  },
): number {
  const top = 30;
  const rightW = 190;
  const rightX = RIGHT - rightW;
  let leftX = M;
  let logoBottom = top;
  if (opts.logo) {
    const b = fitBox(opts.logo, 130, 58);
    doc.image(opts.logo.buf, M, top, { width: b.w, height: b.h });
    leftX = M + b.w + 14;
    logoBottom = top + b.h;
  }
  const c = opts.company;
  const brandW = rightX - 16 - leftX;
  let ly = top;
  if (opts.show?.name !== false) {
    ly = w.put(c.name, leftX, ly, { font: w.F.bold, size: opts.nameSize ?? 15, width: brandW });
    if (c.legalName) ly = w.put(c.legalName, leftX, ly + 1, { size: 7.5, color: w.T.muted, width: brandW });
    ly += 3;
  }
  if (opts.show?.address !== false) for (const l of c.addressLines) ly = w.put(l, leftX, ly, { size: 8, color: w.T.muted, width: brandW });
  if (opts.show?.ids !== false) {
    const ids = [c.gstin ? `GSTIN  ${c.gstin}` : "", c.pan ? `PAN  ${c.pan}` : ""].filter(Boolean).join("     ");
    if (ids) ly = w.put(ids, leftX, ly + 2, { font: w.F.semibold, size: 8, width: brandW });
  }
  if (c.contact) ly = w.put(c.contact, leftX, ly + 1, { size: 7.5, color: w.T.muted, width: brandW });

  const ry = opts.right(rightX, rightW, top);
  const y = Math.max(ly, ry, logoBottom) + 14;
  w.hline(M, RIGHT, y, w.T.line, 0.8);
  return y + 14;
}

/** Two-column key/value card. Returns its height (drawn only when `draw` is true). */
export function keyValueCard(
  doc: PdfDoc,
  w: Writer,
  opts: { x: number; y: number; width: number; title: string; rows: [string, string][]; keyW?: number; fill?: string; size: number; draw?: boolean; minH?: number },
): number {
  const pad = 12;
  const keyW = opts.keyW ?? 88;
  const inner = opts.width - 2 * pad;
  const h =
    2 * pad +
    14 +
    opts.rows.reduce((s, [, v]) => s + Math.max(w.measure(v, w.F.semibold, opts.size - 0.5, inner - keyW), opts.size + 3) + 3, 0);
  const height = Math.max(h, opts.minH ?? 0);
  if (opts.draw === false) return height;
  if (opts.fill) doc.save().roundedRect(opts.x, opts.y, opts.width, height, 6).fillAndStroke(opts.fill, w.T.tableBorder).restore();
  else doc.save().roundedRect(opts.x, opts.y, opts.width, height, 6).lineWidth(0.8).stroke(w.T.line).restore();
  w.label(opts.title, opts.x + pad, opts.y + pad);
  let y = opts.y + pad + 14;
  for (const [k, v] of opts.rows) {
    w.put(k, opts.x + pad, y, { size: opts.size - 0.5, color: w.T.muted, width: keyW });
    y = Math.max(w.put(v, opts.x + pad + keyW, y, { font: w.F.semibold, size: opts.size - 0.5, width: inner - keyW, align: "right" }), y + opts.size + 3) + 3;
  }
  return height;
}
