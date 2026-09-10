import { pdfBufferFromDoc } from "@/lib/pdf/simple-pdf";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";

export async function buildLinesDocumentPdf(opts: {
  title: string;
  subtitle?: string;
  meta: [string, string][];
  columns: string[];
  rows: (string | number)[][];
  footerLines?: string[];
}): Promise<Buffer> {
  const { title, subtitle, meta, columns, rows, footerLines } = opts;
  const colW: number[] =
    columns.length === 4
      ? [220, 55, 55, 70]
      : columns.length === 2
        ? [260, 260]
        : Array.from({ length: columns.length }, () => Math.floor(480 / columns.length));

  return pdfBufferFromDoc((doc) => {
    doc.fontSize(16).text(title);
    if (subtitle) doc.fontSize(10).fillColor("#555").text(subtitle).fillColor("#000");
    doc.moveDown();
    doc.fontSize(9);
    for (const [k, v] of meta) {
      doc.text(`${k}: ${v}`);
    }
    doc.moveDown();
    let x = 50;
    let y = doc.y + 6;
    doc.fontSize(8).fillColor("#333");
    columns.forEach((c, i) => {
      const w = colW[i] ?? 80;
      doc.text(c, x, y, { width: w, continued: i < columns.length - 1 });
      x += w;
    });
    doc.fillColor("#000");
    y += 14;
    doc.moveTo(48, y).lineTo(545, y).stroke("#ddd");
    y += 8;
    for (const row of rows) {
      x = 50;
      row.forEach((cell, i) => {
        const s = typeof cell === "number" ? fmtMoney(cell) : String(cell);
        const w = colW[i] ?? 80;
        doc.fontSize(8).text(s.slice(0, 200), x, y, { width: w, continued: i < row.length - 1 });
        x += w;
      });
      y += 16;
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
    }
    if (footerLines?.length) {
      y += 12;
      doc.fontSize(9);
      for (const line of footerLines) doc.text(line, 50, y, { width: 480 });
    }
  });
}
