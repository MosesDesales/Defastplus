import type { InvoicePdfPayload } from "@/lib/documents/invoice-pdf-data";
import { fmtMoney } from "@/lib/documents/invoice-pdf-data";
import type { DocumentTemplateConfig } from "@/lib/document-template-types";
import { invoiceSummaryViewFromStored } from "@/lib/sales/invoice-document-summary";
import { logoBufferFromUrl } from "@/lib/pdf/logo-image-buffer";
import { pdfBufferFromDoc } from "@/lib/pdf/simple-pdf";

/** Align with app marketing / dashboard teal */
const THEME_BASE = {
  primary: "#0f766e",
  primaryDark: "#115e59",
  headerBand: "#f0fdfa",
  headerBandBorder: "#99f6e4",
  rowStripe: "#f8fafc",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
} as const;

type Theme = {
  primary: string;
  primaryDark: string;
  headerBand: string;
  headerBandBorder: string;
  rowStripe: string;
  text: string;
  muted: string;
  border: string;
};

function darkenHex(hex: string, factor = 0.82): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return THEME_BASE.primaryDark;
  const n = parseInt(m[1]!, 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function themeFromTemplate(cfg: DocumentTemplateConfig | null | undefined): Theme {
  if (!cfg) return { ...THEME_BASE };
  const c = cfg.colors;
  return {
    ...THEME_BASE,
    primary: c.primary,
    primaryDark: darkenHex(c.primary),
    headerBand: c.tableHeaderBg,
    headerBandBorder: c.tableBorder,
  };
}

type Col = { key: string; label: string; frac: number; align: "left" | "right" };

const LINE_COLS: Col[] = [
  { key: "desc", label: "Description", frac: 0.26, align: "left" },
  { key: "qty", label: "Qty", frac: 0.06, align: "right" },
  { key: "rate", label: "Rate", frac: 0.14, align: "right" },
  { key: "tax", label: "Tax %", frac: 0.06, align: "right" },
  { key: "cgst", label: "CGST", frac: 0.12, align: "right" },
  { key: "sgst", label: "SGST", frac: 0.12, align: "right" },
  { key: "igst", label: "IGST", frac: 0.1, align: "right" },
  { key: "total", label: "Total", frac: 0.14, align: "right" },
];

function companyAddressLines(company: InvoicePdfPayload["company"]): string[] {
  if (!company) return [];
  const line = [company.billingStreet, company.billingCity, company.billingState, company.billingZip, company.billingCountry]
    .filter(Boolean)
    .join(", ");
  return line ? [line] : [];
}

function layoutColumns(margin: number, contentW: number): { x: number; w: number; label: string; align: "left" | "right" }[] {
  const cols = [...LINE_COLS];
  let x = margin;
  const out: { x: number; w: number; label: string; align: "left" | "right" }[] = [];
  for (let i = 0; i < cols.length; i++) {
    const isLast = i === cols.length - 1;
    const w = isLast ? margin + contentW - x : Math.floor(contentW * cols[i]!.frac);
    out.push({ x, w, label: cols[i]!.label, align: cols[i]!.align });
    x += w;
  }
  return out;
}

export type BuildInvoicePdfOptions = {
  template?: DocumentTemplateConfig | null;
};

export async function buildInvoicePdfBuffer(data: InvoicePdfPayload, options?: BuildInvoicePdfOptions): Promise<Buffer> {
  const { invoice: inv, company } = data;
  const cfg = options?.template ?? null;
  const THEME = themeFromTemplate(cfg);
  const showLogo = cfg?.header.showLogo !== false;
  const logoBuf =
    showLogo && company?.logoUrl ? await logoBufferFromUrl(company.logoUrl) : null;

  return pdfBufferFromDoc((doc) => {
    const margin = doc.page.margins.left;
    const pageW = doc.page.width;
    const contentW = pageW - doc.page.margins.left - doc.page.margins.right;
    const rightX = pageW - margin;
    const cols = layoutColumns(margin, contentW);

    // Top accent bar (theme)
    doc.save();
    doc.rect(margin, margin, contentW, 4).fill(THEME.primary);
    doc.restore();
    doc.y = margin + 12;

    // —— Header: left = label + invoice # + dates, right = company (matches preview)
    const headerTop = doc.y;
    let leftTextX = margin;
    if (logoBuf) {
      try {
        const lw = 56;
        const lh = 28;
        doc.image(logoBuf, margin, headerTop, { width: lw, height: lh, fit: [lw, lh] });
        leftTextX = margin + lw + 10;
      } catch {
        leftTextX = margin;
      }
    }
    doc.fillColor(THEME.primary).font("Helvetica-Bold").fontSize(8).text("TAX INVOICE", leftTextX, headerTop);
    if (cfg?.documentInfo.showNumber !== false) {
      doc.fillColor(THEME.text).font("Helvetica-Bold").fontSize(18).text(inv.invoiceNumber, leftTextX, headerTop + 12, { width: 300 });
    }
    if (cfg?.documentInfo.showIssueDate !== false || cfg?.documentInfo.showDueDate !== false) {
      const parts: string[] = [];
      if (cfg?.documentInfo.showIssueDate !== false) {
        parts.push(`Issued ${inv.issueDate.toISOString().slice(0, 10)}`);
      }
      if (cfg?.documentInfo.showDueDate !== false && inv.dueDate) {
        parts.push(`Due ${inv.dueDate.toISOString().slice(0, 10)}`);
      }
      const dateStr = parts.join(" · ");
      if (dateStr) {
        doc.font("Helvetica").fontSize(9).fillColor(THEME.muted).text(dateStr, leftTextX, headerTop + 34, { width: 280 });
      }
    }

    const companyBlockW = 200;
    const companyX = rightX - companyBlockW;
    let cy = headerTop;
    if (cfg?.header.showCompanyName !== false) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(THEME.text).text(company?.companyName ?? "Company", companyX, cy, {
        width: companyBlockW,
        align: "right",
      });
      cy = doc.y;
    }
    if (cfg?.header.showGstin !== false && company?.gstin) {
      doc.font("Helvetica").fontSize(9).fillColor(THEME.muted).text(`GSTIN: ${company.gstin}`, companyX, cy, {
        width: companyBlockW,
        align: "right",
      });
      cy = doc.y;
    }
    if (cfg?.header.showAddress !== false) {
      const addrPreview = companyAddressLines(company)[0];
      if (addrPreview) {
        doc.font("Helvetica").fontSize(8).fillColor(THEME.muted).text(addrPreview, companyX, cy + 2, {
          width: companyBlockW,
          align: "right",
          lineGap: 1,
        });
      }
    }

    doc.y = Math.max(doc.y, headerTop + 60) + 8;
    doc.moveTo(margin, doc.y).lineTo(rightX, doc.y).strokeColor(THEME.border).lineWidth(0.5).stroke();
    doc.moveDown(0.8);

    // Bill to + currency / status
    const metaY = doc.y;
    const partyLabel = (cfg?.party.label ?? "BILL TO").toUpperCase();
    let by = metaY;
    if (cfg?.party.show !== false) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(THEME.muted).text(partyLabel, margin, metaY);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(THEME.text).text(inv.customer.displayName, margin, metaY + 12, { width: 260 });
      by = doc.y;
      if (inv.customer.gstin) {
        doc.font("Helvetica").fontSize(9).fillColor(THEME.text).text(`GSTIN: ${inv.customer.gstin}`, margin, by, { width: 260 });
        by = doc.y;
      }
      if (inv.customer.email) {
        doc.text(inv.customer.email, margin, by, { width: 260 });
        by = doc.y;
      }
    }

    const metaRightY = metaY;
    doc.font("Helvetica").fontSize(9).fillColor(THEME.text);
    doc.text(`Currency: ${inv.currency}`, companyX, metaRightY, { width: companyBlockW, align: "right" });
    doc.text(`Status: ${inv.status}`, companyX, metaRightY + 12, { width: companyBlockW, align: "right" });

    doc.y = Math.max(by, metaRightY + 32) + 6;

    // —— Line table (same columns as web preview)
    const tableTop = doc.y;
    const headerH = 22;
    doc.save();
    doc.rect(margin, tableTop, contentW, headerH).fill(THEME.headerBand);
    doc.strokeColor(THEME.headerBandBorder).rect(margin, tableTop, contentW, headerH).stroke();
    doc.fillColor(THEME.primaryDark).font("Helvetica-Bold").fontSize(7);
    for (const c of cols) {
      const pad = c.align === "left" ? 4 : 2;
      doc.text(c.label, c.x + pad, tableTop + 7, { width: c.w - pad - 2, align: c.align });
    }
    doc.restore();

    let rowY = tableTop + headerH;
    const bottomSafe = doc.page.height - doc.page.margins.bottom - 100;

    const drawRowBg = (y: number, h: number, stripe: boolean) => {
      if (!stripe) return;
      doc.save();
      doc.rect(margin, y, contentW, h).fill(THEME.rowStripe);
      doc.restore();
    };

    inv.lines.forEach((l, idx) => {
      const desc = l.description.slice(0, 500);
      doc.font("Helvetica").fontSize(8);
      const descH = doc.heightOfString(desc, { width: cols[0]!.w - 8 });
      const rowH = Math.max(20, descH + 8);

      if (rowY + rowH > bottomSafe) {
        doc.addPage();
        rowY = margin + 20;
      }

      drawRowBg(rowY, rowH, idx % 2 === 0);
      doc.fillColor(THEME.text).font("Helvetica").fontSize(8);
      doc.text(desc, cols[0]!.x + 4, rowY + 4, { width: cols[0]!.w - 8 });
      doc.text(String(Number(l.quantity)), cols[1]!.x + 2, rowY + 4, { width: cols[1]!.w - 4, align: "right" });
      doc.text(fmtMoney(Number(l.rate)), cols[2]!.x + 2, rowY + 4, { width: cols[2]!.w - 4, align: "right" });
      doc.text(String(Number(l.taxPercent)), cols[3]!.x + 2, rowY + 4, { width: cols[3]!.w - 4, align: "right" });
      doc.text(fmtMoney(Number(l.lineCgst)), cols[4]!.x + 2, rowY + 4, { width: cols[4]!.w - 4, align: "right" });
      doc.text(fmtMoney(Number(l.lineSgst)), cols[5]!.x + 2, rowY + 4, { width: cols[5]!.w - 4, align: "right" });
      doc.text(fmtMoney(Number(l.lineIgst)), cols[6]!.x + 2, rowY + 4, { width: cols[6]!.w - 4, align: "right" });
      doc.font("Helvetica-Bold").text(fmtMoney(Number(l.lineTotal)), cols[7]!.x + 2, rowY + 4, { width: cols[7]!.w - 4, align: "right" });

      doc.moveTo(margin, rowY + rowH).lineTo(rightX, rowY + rowH).strokeColor(THEME.border).lineWidth(0.35).stroke();
      rowY += rowH;
    });

    doc.y = rowY + 10;
    if (doc.y > bottomSafe) {
      doc.addPage();
      doc.y = margin + 20;
    }

    // —— Totals + document summary (matches web preview)
    const sv = invoiceSummaryViewFromStored(inv);
    const totalsW = 220;
    const totalsX = rightX - totalsW;
    doc.moveTo(margin, doc.y).lineTo(rightX, doc.y).strokeColor(THEME.border).stroke();
    doc.moveDown(0.6);
    let ty = doc.y;
    const labelW = totalsW - 92;
    const row = (label: string, value: string, opts?: { bold?: boolean; labelColor?: string; valueSize?: number }) => {
      const f = opts?.bold ? "Helvetica-Bold" : "Helvetica";
      const fs = opts?.valueSize ?? 9;
      doc.font(f).fontSize(fs).fillColor(opts?.labelColor ?? THEME.muted).text(label, totalsX, ty, { width: labelW, align: "left" });
      doc.font(f).fontSize(fs).fillColor(THEME.text).text(value, totalsX + labelW, ty, { width: 92, align: "right" });
      ty += opts?.bold ? 16 : 13;
    };

    const sum = cfg?.summary;
    const showNet = sum?.showSubtotal !== false;
    const showTax = sum?.showGstSplit !== false;
    if (showNet) row("Sub total (ex tax)", fmtMoney(sv.lineNetSum));
    if (showTax) row("Tax (lines)", fmtMoney(sv.lineTaxSum));
    if (showNet || showTax) {
      row("Subtotal (ex tax + tax)", fmtMoney(sv.lineGrand), { labelColor: THEME.text });
    }
    if (sv.discountPercent > 0 && sv.discountAmount > 0) {
      row(`Discount (${sv.discountPercent}%)`, fmtMoney(sv.discountAmount));
      row("After discount + scaled tax", fmtMoney(sv.preWithholding), { labelColor: THEME.muted });
    }
    if (sv.withholdingType !== "NONE" && sv.withholdingAmount > 0) {
      row(
        `${sv.withholdingType} (${sv.withholdingPercent}%)`,
        `${sv.withholdingType === "TDS" ? "− " : "+ "}${fmtMoney(sv.withholdingAmount)}`,
        { labelColor: THEME.muted },
      );
    }
    if (Math.abs(sv.adjustmentAmount) > 0.0005) {
      row(sv.adjustmentLabel, fmtMoney(sv.adjustmentAmount), { labelColor: THEME.muted });
    }
    ty += 2;
    doc.moveTo(totalsX, ty).lineTo(rightX, ty).strokeColor(THEME.border).lineWidth(0.5).stroke();
    ty += 10;
    if (cfg?.summary.showTotal !== false) {
      row("Total ( ₹ )", fmtMoney(sv.payableTotal), { bold: true, labelColor: THEME.primaryDark, valueSize: 11 });
      ty += 6;
    }

    const footCfg = cfg?.footer ?? null;
    const notesText = (footCfg?.notes ?? "").trim();
    if (footCfg && footCfg.showNotes !== false && notesText) {
      ty += 4;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(THEME.muted).text("Notes", margin, ty);
      ty = doc.y + 2;
      doc.font("Helvetica").fontSize(8).fillColor(THEME.text).text(notesText, margin, ty, { width: contentW, lineGap: 2 });
      ty = doc.y + 6;
    }
    const termsText = (footCfg?.terms ?? "").trim();
    if (footCfg && footCfg.showTerms !== false && termsText) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(THEME.muted).text("Terms & conditions", margin, ty);
      ty = doc.y + 2;
      doc.font("Helvetica").fontSize(8).fillColor(THEME.text).text(termsText, margin, ty, { width: contentW, lineGap: 2 });
      ty = doc.y + 6;
    }
    if (footCfg && footCfg.showSignature !== false && (footCfg.signatureLabel ?? "").trim()) {
      doc.font("Helvetica").fontSize(8).fillColor(THEME.muted).text(footCfg.signatureLabel, rightX - 160, ty, {
        width: 160,
        align: "right",
      });
      ty = doc.y + 28;
    }

    // —— Footer: theme bar + company name + full address (centered)
    doc.y = ty + 8;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 72) {
      doc.addPage();
      doc.y = margin + 20;
    }

    const footerTop = doc.y;
    doc.save();
    doc.rect(margin, footerTop, contentW, 4).fill(THEME.primary);
    doc.restore();
    let fy = footerTop + 12;

    const footName = company?.companyName ?? "Company";
    doc.font("Helvetica-Bold").fontSize(9).fillColor(THEME.primary).text(footName, margin, fy, {
      width: contentW,
      align: "center",
    });
    fy = doc.y + 2;

    const addrLines = companyAddressLines(company);
    if (addrLines.length) {
      doc.font("Helvetica").fontSize(8).fillColor(THEME.muted).text(addrLines[0]!, margin, fy, {
        width: contentW,
        align: "center",
        lineGap: 2,
      });
      fy = doc.y;
    }
    if (company?.gstin) {
      doc.font("Helvetica").fontSize(8).fillColor(THEME.muted).text(`GSTIN: ${company.gstin}`, margin, fy + 2, {
        width: contentW,
        align: "center",
      });
    }
  });
}
