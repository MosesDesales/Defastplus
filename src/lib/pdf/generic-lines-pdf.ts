import { docCompany, type CompanyForDocs } from "@/lib/documents/business-document";
import {
  BODY_LIMIT,
  CONT_TOP,
  CONTENT_W,
  M,
  RIGHT,
  drawBrandHeader,
  installContinuationHeader,
  keyValueCard,
  loadLogo,
  makeTheme,
  makeWriter,
  money,
  renderPdf,
  stampPageChrome,
} from "@/lib/pdf/pdf-kit";

/** Branded tabular report (used by e-way bill reports). Numbers are right-aligned in Indian format. */
export async function buildLinesDocumentPdf(opts: {
  title: string;
  subtitle?: string;
  meta: [string, string][];
  columns: string[];
  rows: (string | number)[][];
  footerLines?: string[];
  company?: CompanyForDocs | null;
}): Promise<Buffer> {
  const { title, subtitle, meta, columns, rows, footerLines } = opts;
  const company = docCompany(opts.company ?? null);
  const logo = await loadLogo(company.logoUrl);
  const numeric = columns.map((_, ci) => rows.length > 0 && rows.every((r) => typeof r[ci] === "number"));

  return renderPdf({ Title: title, Author: company.name }, (doc, F) => {
    const T = makeTheme();
    const base = 9;
    const w = makeWriter(doc, F, T, base);
    const { put, hline, label, measure, ensureSpace } = w;
    const removeHeader = installContinuationHeader(doc, w, { logo, companyName: company.name, gstin: company.gstin, title: title.toUpperCase(), number: subtitle ?? "Report" });

    let y = drawBrandHeader(doc, w, {
      logo,
      company,
      right: (rx, rw, top) => {
        let ry = put(title, rx, top - 2, { font: F.bold, size: 14, color: T.primary, width: rw, align: "right" });
        if (subtitle) ry = put(subtitle, rx, ry + 2, { size: 8, color: T.muted, width: rw, align: "right" });
        return put(`${rows.length} record${rows.length === 1 ? "" : "s"}`, rx, ry + 6, { font: F.semibold, size: 9, width: rw, align: "right" });
      },
    });
    if (meta.length) y += keyValueCard(doc, w, { x: M, y, width: CONTENT_W, title: "Details", rows: meta, keyW: 140, size: base, fill: T.soft }) + 16;

    // First column gets extra room; the rest share evenly.
    const n = columns.length;
    const firstW = n > 2 ? Math.min(180, CONTENT_W * 0.3) : CONTENT_W / n;
    const restW = n > 1 ? (CONTENT_W - firstW) / (n - 1) : 0;
    const colW = columns.map((_, i) => (i === 0 ? firstW : restW));
    const headH = 24;
    const drawHead = (at: number) => {
      doc.save().rect(M, at, CONTENT_W, headH).fill(T.tableHead).restore();
      let x = M;
      columns.forEach((c, i) => {
        put(c.toUpperCase(), x + 5, at + 8.5, { font: F.semibold, size: 6.6, color: T.primaryDark, width: colW[i]! - 10, align: numeric[i] ? "right" : "left", spacing: 0.3, oneLine: true });
        x += colW[i]!;
      });
      return at + headH;
    };
    y = drawHead(ensureSpace(y, headH + 30));
    rows.forEach((row, ri) => {
      const cells = row.map((c) => (typeof c === "number" ? money(c) : String(c).slice(0, 300)));
      const rowH = Math.max(...cells.map((c, i) => (numeric[i] ? base : measure(c, F.regular, base - 1, colW[i]! - 10)))) + 12;
      if (y + rowH > BODY_LIMIT) {
        doc.addPage();
        y = drawHead(CONT_TOP);
      }
      if (ri % 2 === 1) doc.save().rect(M, y, CONTENT_W, rowH).fill(T.stripe).restore();
      let x = M;
      cells.forEach((c, i) => {
        put(c, x + 5, y + 6, { size: base - 1, width: colW[i]! - 10, align: numeric[i] ? "right" : "left" });
        x += colW[i]!;
      });
      y += rowH;
      hline(M, RIGHT, y, T.line, 0.4);
    });
    if (!rows.length) {
      put("No records for this period.", M, y + 12, { size: base, color: T.muted, width: CONTENT_W, align: "center" });
      y += 36;
    }
    if (footerLines?.length) {
      y = ensureSpace(y + 14, 20 + footerLines.length * 14);
      label("Notes", M, y);
      y += 13;
      for (const line of footerLines) y = put(line, M, y, { size: base - 1, width: CONTENT_W }) + 2;
    }

    removeHeader();
    stampPageChrome(doc, w, {
      identity: [company.name, company.gstin ? `GSTIN ${company.gstin}` : ""].filter(Boolean).join("  ·  "),
      footerNote: `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date())}`,
      reference: title,
    });
  });
}
