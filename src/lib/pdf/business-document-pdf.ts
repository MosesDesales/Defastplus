import type { BusinessDocument, DocLine } from "@/lib/documents/business-document";
import {
  BODY_LIMIT,
  CONT_TOP,
  CONTENT_W,
  M,
  RIGHT,
  drawBrandHeader,
  fmtQty,
  installContinuationHeader,
  keyValueCard,
  loadLogo,
  makeTheme,
  makeWriter,
  money,
  renderPdf,
  stampPageChrome,
  type Logo,
  type PdfDoc,
  type Writer,
} from "@/lib/pdf/pdf-kit";
import type { PdfFonts } from "@/lib/pdf/pdf-fonts";

type Col = {
  key: "idx" | "desc" | "hsn" | "qty" | "rate" | "taxable" | "cgst" | "sgst" | "igst" | "gst" | "amount";
  label: string;
  w: number;
  align: "left" | "right" | "center";
  x: number;
};

function buildColumns(d: BusinessDocument): Col[] {
  const c = d.columns;
  const spec: Omit<Col, "x">[] = [
    { key: "idx", label: "#", w: 24, align: "center" },
    { key: "desc", label: d.kind === "expense" ? "Expense Account" : "Item & Description", w: 0, align: "left" },
  ];
  if (c.hsn) spec.push({ key: "hsn", label: "HSN/SAC", w: 48, align: "left" });
  if (c.qty) spec.push({ key: "qty", label: "Qty", w: 44, align: "right" });
  if (c.rate) spec.push({ key: "rate", label: "Rate", w: 58, align: "right" });
  if (c.taxable && c.tax) spec.push({ key: "taxable", label: "Taxable Value", w: 62, align: "right" });
  if (c.tax) {
    if (d.taxMode === "split") spec.push({ key: "cgst", label: "CGST", w: 54, align: "right" }, { key: "sgst", label: "SGST", w: 54, align: "right" });
    else if (d.taxMode === "igst") spec.push({ key: "igst", label: "IGST", w: 60, align: "right" });
    else if (d.taxMode === "mixed") spec.push({ key: "gst", label: d.kind === "expense" ? "Tax" : "GST", w: 60, align: "right" });
  }
  spec.push({ key: "amount", label: "Amount", w: 70, align: "right" });
  const desc = spec.find((s) => s.key === "desc")!;
  desc.w = CONTENT_W - spec.reduce((s, x) => s + x.w, 0);
  let x = M;
  return spec.map((s) => {
    const col = { ...s, x };
    x += s.w;
    return col;
  });
}

export async function buildBusinessDocumentPdf(d: BusinessDocument): Promise<Buffer> {
  const logo = d.showLogo ? await loadLogo(d.company.logoUrl) : null;
  return renderPdf(
    { Title: `${titleCase(d.title)} ${d.number}`, Author: d.company.name, Subject: d.party ? `${titleCase(d.title)} for ${d.party.name}` : undefined },
    (doc, F) => render(doc, F, d, logo),
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function render(doc: PdfDoc, F: PdfFonts, d: BusinessDocument, logo: Logo | null) {
  const T = makeTheme(d.theme);
  const base = d.baseSize;
  const w = makeWriter(doc, F, T, base);
  const { put, measure, hline, label, ensureSpace } = w;
  const sym = d.currency === "INR" ? F.rupee : d.currency;
  const cur = (n: number) => `${sym} ${money(n)}`;
  const cols = buildColumns(d);

  const removeHeader = installContinuationHeader(doc, w, {
    logo,
    companyName: d.company.name,
    gstin: d.company.gstin,
    title: d.title,
    number: d.number,
  });

  // ── Page 1 header ──────────────────────────────────────────────────────────
  let y = drawBrandHeader(doc, w, {
    logo,
    company: d.company,
    nameSize: Math.max(13, Math.min(18, d.headerSize + 4)),
    right: (rx, rw, top) => {
      const titleSize = d.title.length > 12 ? 16 : 20;
      let ry = put(d.title, rx, top - 2, { font: F.bold, size: titleSize, color: T.primary, width: rw, align: "right", spacing: 0.6 });
      if (d.copyLabel) ry = put(d.copyLabel, rx, ry, { font: F.medium, size: 7, color: T.muted, width: rw, align: "right", spacing: 0.4 });
      ry = put(`# ${d.number}`, rx, ry + 6, { font: F.semibold, size: 10, width: rw, align: "right" });
      if (d.headline) {
        ry = put(d.headline.label, rx, ry + 6, { size: 7.5, color: T.muted, width: rw, align: "right" });
        ry = put(cur(d.headline.value), rx, ry, { font: F.bold, size: 14, width: rw, align: "right" });
      }
      return ry;
    },
  });

  // ── Party + details cards ─────────────────────────────────────────────────
  const gap = 12;
  const cardW = (CONTENT_W - gap) / 2;
  const pad = 12;
  const innerW = cardW - 2 * pad;
  const party = d.party;
  const partyH = party
    ? 2 * pad + 14 + measure(party.name, F.bold, base + 1.5, innerW) + 2 + party.lines.reduce((h, l) => h + measure(l.text, F.regular, base - 0.5, innerW) + 2, 0)
    : 0;
  const detX = party ? M + cardW + gap : M;
  const detW = party ? cardW : CONTENT_W;
  const detH = keyValueCard(doc, w, { x: detX, y, width: detW, title: d.detailsTitle, rows: d.details, size: base, draw: false });
  const cardH = Math.max(partyH, detH);
  if (party) {
    doc.save().roundedRect(M, y, cardW, cardH, 6).fillAndStroke(T.soft, T.tableBorder).restore();
    label(party.label, M + pad, y + pad);
    let by = put(party.name, M + pad, y + pad + 14, { font: F.bold, size: base + 1.5, width: innerW }) + 2;
    for (const l of party.lines) {
      by =
        put(l.text, M + pad, by, {
          font: l.tone === "strong" ? F.semibold : F.regular,
          size: l.tone === "muted" ? base - 1 : base - 0.5,
          color: l.tone === "muted" ? T.muted : T.text,
          width: innerW,
        }) + 2;
    }
  }
  keyValueCard(doc, w, { x: detX, y, width: detW, title: d.detailsTitle, rows: d.details, size: base, minH: cardH });
  y += cardH + 18;

  // ── Line items ─────────────────────────────────────────────────────────────
  y = drawLineTable(doc, w, F, d, cols, y);

  // ── Amount in words + GST summary (left) and totals card (right) ───────────
  y = drawSummary(doc, w, F, d, y, cur);

  // ── Notes / terms ─────────────────────────────────────────────────────────
  for (const n of d.notes) {
    const h = 14 + measure(n.body, F.regular, base - 1, CONTENT_W, 2);
    y = ensureSpace(y, Math.min(h, 80));
    label(n.title, M, y);
    // Long text may flow onto further pages; `put` returns the y on the page where it ended.
    y = put(n.body, M, y + 13, { size: base - 1, width: CONTENT_W, lineGap: 2 }) + 12;
  }

  // ── Bank details (left) + signature (right), kept together ─────────────────
  if (d.bank || d.signature) {
    const bankRows: [string, string][] = d.bank
      ? ([
          ["Account Name", d.bank.accountName],
          ["Bank", d.bank.bankName],
          ["Account No.", d.bank.accountNumber],
          ["IFSC", d.bank.ifsc],
          ["Branch", d.bank.branch],
          ["UPI", d.bank.upi],
        ].filter(([, v]) => v) as [string, string][])
      : [];
    const bankW = 270;
    const bankH = d.bank ? keyValueCard(doc, w, { x: M, y, width: bankW, title: "Bank Details", rows: bankRows, keyW: 82, size: base, draw: false }) : 0;
    y = ensureSpace(y, Math.max(bankH, 74) + 4);
    if (d.bank) keyValueCard(doc, w, { x: M, y, width: bankW, title: "Bank Details", rows: bankRows, keyW: 82, size: base, fill: T.soft });
    if (d.signature) {
      const sigW = 200;
      const sx = RIGHT - sigW;
      const sy = d.bank ? y + Math.max(0, bankH - 74) : y;
      put(d.signature.forLabel, sx, sy, { font: F.semibold, size: base - 0.5, width: sigW, align: "right" });
      hline(sx + 40, RIGHT, sy + 52, T.text, 0.6);
      put(d.signature.label, sx, sy + 56, { size: base - 1.5, color: T.muted, width: sigW, align: "right" });
    }
  }

  removeHeader();
  stampPageChrome(doc, w, {
    identity: [d.company.name, d.company.gstin ? `GSTIN ${d.company.gstin}` : ""].filter(Boolean).join("  ·  "),
    footerNote: d.footerNote,
    reference: d.number,
    watermark: d.watermark,
  });
}

function drawLineTable(doc: PdfDoc, w: Writer, F: PdfFonts, d: BusinessDocument, cols: Col[], startY: number) {
  const { put, measure, hline, ensureSpace, T } = w;
  const headH = 24;
  const cellPad = 5;
  const bodySize = d.baseSize - 1;
  const subSize = 6.6;

  const drawHeader = (at: number) => {
    doc.save().rect(M, at, CONTENT_W, headH).fill(T.tableHead).restore();
    for (const c of cols) {
      const pad = c.key === "idx" ? 2 : cellPad;
      const text = c.label.toUpperCase();
      const twoLines = measure(text, F.semibold, 6.6, c.w - 2 * pad) > 10;
      put(text, c.x + pad, at + (twoLines ? 4.5 : 8.5), { font: F.semibold, size: 6.6, color: T.primaryDark, width: c.w - 2 * pad, align: c.align, spacing: 0.3, lineGap: 0 });
    }
    return at + headH;
  };

  let y = ensureSpace(startY, headH + 40);
  y = drawHeader(y);
  const hasSub = cols.some((c) => ["cgst", "sgst", "igst", "gst"].includes(c.key)) || d.lines.some((l) => l.unit);
  const descCol = cols.find((c) => c.key === "desc")!;

  d.lines.forEach((l: DocLine, i) => {
    const desc = l.description.slice(0, 600);
    const descH = measure(desc, F.medium, bodySize, descCol.w - 2 * cellPad);
    const rowH = Math.max(descH, hasSub ? bodySize + subSize + 4 : bodySize + 2) + 14;
    if (y + rowH > BODY_LIMIT) {
      doc.addPage();
      y = drawHeader(CONT_TOP);
    }
    if (i % 2 === 1) doc.save().rect(M, y, CONTENT_W, rowH).fill(T.stripe).restore();
    const half = Math.round((l.taxPercent / 2) * 100) / 100;
    const cell = (c: Col, main: string, sub?: string | null, bold = false) => {
      const pad = c.key === "idx" ? 2 : cellPad;
      put(main, c.x + pad, y + 7, { font: bold ? F.semibold : F.regular, size: bodySize, width: c.w - 2 * pad, align: c.align, oneLine: true });
      if (sub) put(sub, c.x + pad, y + 7 + bodySize + 3, { size: subSize, color: T.muted, width: c.w - 2 * pad, align: c.align, oneLine: true });
    };
    for (const c of cols) {
      switch (c.key) {
        case "idx":
          cell(c, String(i + 1));
          break;
        case "desc":
          put(desc, c.x + cellPad, y + 7, { font: F.medium, size: bodySize, width: c.w - 2 * cellPad });
          break;
        case "hsn":
          cell(c, l.hsn || "—");
          break;
        case "qty":
          cell(c, l.qty == null ? "—" : fmtQty(l.qty), l.unit);
          break;
        case "rate":
          cell(c, l.rate == null ? "—" : money(l.rate));
          break;
        case "taxable":
          cell(c, money(l.taxable));
          break;
        case "cgst":
          cell(c, money(l.cgst), `@ ${half}%`);
          break;
        case "sgst":
          cell(c, money(l.sgst), `@ ${half}%`);
          break;
        case "igst":
          cell(c, money(l.igst), `@ ${l.taxPercent}%`);
          break;
        case "gst":
          cell(c, money(l.tax), l.taxPercent ? `@ ${l.taxPercent}%` : null);
          break;
        case "amount":
          cell(c, money(l.amount), null, true);
          break;
      }
    }
    y += rowH;
    hline(M, RIGHT, y, T.line, 0.5);
  });
  hline(M, RIGHT, y, T.tableBorder, 1);
  return y + 16;
}

function drawSummary(doc: PdfDoc, w: Writer, F: PdfFonts, d: BusinessDocument, startY: number, cur: (n: number) => string) {
  const { put, measure, hline, label, ensureSpace, T } = w;
  const base = d.baseSize;
  const totW = 214;
  const totX = RIGHT - totW;
  const leftW = totX - M - 20;
  const rowStep = base + 7;
  const bandH = d.total ? 34 : 0;
  const totH = 12 + d.totals.length * rowStep + 6 + bandH;

  const mode = d.taxMode;
  type G = NonNullable<BusinessDocument["gstSummary"]>[number];
  const gstCols: [string, (g: G) => string][] = [["GST Rate", (g) => `${g.rate}%`], ["Taxable", (g) => money(g.taxable)]];
  if (mode === "split" || mode === "mixed") gstCols.push(["CGST", (g) => money(g.cgst)], ["SGST", (g) => money(g.sgst)]);
  if (mode === "igst" || mode === "mixed") gstCols.push(["IGST", (g) => money(g.igst)]);
  gstCols.push(["Total Tax", (g) => money(g.tax)]);
  const gstRowH = base + 8;
  const words = d.amountInWords;
  const wordsH = words ? 12 + measure(words, F.medium, base - 0.5, leftW) : 0;
  const gst = d.gstSummary;
  const gstH = gst ? 16 + gstRowH * (gst.length + 1) + (d.gstSummaryNote ? 12 : 0) : 0;
  const blockH = Math.max(totH, wordsH + (gstH ? gstH + 14 : 0));

  const top = ensureSpace(startY, blockH + 8);

  // Totals card
  doc.save().roundedRect(totX, top, totW, totH, 6).lineWidth(0.8).stroke(T.line).restore();
  let ty = top + 12;
  for (const r of d.totals) {
    put(r.label, totX + 12, ty, { size: base - 0.5, color: T.muted, width: totW - 120 });
    const v = `${r.sign === "minus" ? "− " : r.sign === "plus" ? "+ " : ""}${money(r.value)}`;
    put(v, totX + totW - 112, ty, { font: F.medium, size: base - 0.5, width: 100, align: "right" });
    ty += rowStep;
  }
  if (d.total) {
    const by = top + totH - bandH;
    doc.save().roundedRect(totX, by, totW, bandH, 6).fill(T.primary).restore();
    put(d.total.label, totX + 12, by + 11, { font: F.semibold, size: base, color: "#ffffff", width: 96 });
    put(cur(d.total.value), totX + 96, by + 9.5, { font: F.bold, size: base + 3, color: "#ffffff", width: totW - 108, align: "right" });
  }

  let wy = top;
  if (words) {
    label("Amount in words", M, wy);
    wy = put(words, M, wy + 12, { font: F.medium, size: base - 0.5, width: leftW });
  }
  if (gst) {
    wy += 14;
    label("GST Summary", M, wy);
    wy += 16;
    const gw = leftW / gstCols.length;
    doc.save().rect(M, wy, leftW, gstRowH).fill(T.soft).restore();
    gstCols.forEach(([h], ci) =>
      put(h, M + ci * gw + 4, wy + 4, { font: F.semibold, size: 6.8, color: T.primaryDark, width: gw - 8, align: ci === 0 ? "left" : "right", oneLine: true }),
    );
    wy += gstRowH;
    for (const g of gst) {
      gstCols.forEach(([, f], ci) => put(f(g), M + ci * gw + 4, wy + 4, { size: base - 1.5, width: gw - 8, align: ci === 0 ? "left" : "right", oneLine: true }));
      wy += gstRowH;
      hline(M, M + leftW, wy, T.line, 0.4);
    }
    if (d.gstSummaryNote) put(d.gstSummaryNote, M, wy + 3, { size: 6.5, color: T.muted, width: leftW });
  }
  return top + blockH + 18;
}
