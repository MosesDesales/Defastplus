import { amountInWords } from "@/lib/amount-in-words";
import { docCompany, fmtDocDate, type CompanyForDocs } from "@/lib/documents/business-document";
import {
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

export type PayslipPdfInput = {
  company: (Partial<CompanyForDocs> & { companyName: string | null; logoUrl: string | null }) | null;
  employee: {
    displayName: string;
    employeeNumber: string;
    department: string | null;
    designation: string | null;
    dateOfJoining: Date | null;
    bankAccountName: string | null;
    bankIfsc: string | null;
    bankAccountNo: string | null;
    pan: string | null;
  };
  yearMonth: string;
  daysPaid: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  gross: number;
  totalDeductions: number;
  netPay: number;
  leaveLines: { name: string; alloted: number; availed: number; takenYtd: number; balance: number }[];
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function payslipMonthLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Payslips are emailed, so only the last four digits of the account are printed. */
export function maskAccount(no: string | null | undefined) {
  const v = no?.replace(/\s+/g, "") ?? "";
  if (!v) return "—";
  return v.length <= 4 ? v : `${"•".repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`;
}

export async function buildPayslipPdfBuffer(input: PayslipPdfInput): Promise<Buffer> {
  const company = docCompany({
    companyName: input.company?.companyName ?? null,
    logoUrl: input.company?.logoUrl ?? null,
    gstin: input.company?.gstin ?? null,
    billingStreet: input.company?.billingStreet ?? null,
    billingCity: input.company?.billingCity ?? null,
    billingState: input.company?.billingState ?? null,
    billingZip: input.company?.billingZip ?? null,
    billingCountry: input.company?.billingCountry ?? "IN",
    billingStreet2: input.company?.billingStreet2 ?? null,
    phone: input.company?.phone ?? null,
    contactEmail: input.company?.contactEmail ?? null,
    websiteUrl: input.company?.websiteUrl ?? null,
  });
  const logo = await loadLogo(company.logoUrl);
  const month = payslipMonthLabel(input.yearMonth);
  const e = input.employee;
  const ref = `${e.employeeNumber} · ${month}`;

  return renderPdf({ Title: `Payslip ${month} — ${e.displayName}`, Author: company.name }, (doc, F) => {
    const T = makeTheme();
    const base = 9;
    const w = makeWriter(doc, F, T, base);
    const { put, hline, label, ensureSpace, measure } = w;
    const cur = (n: number) => `${F.rupee} ${money(n)}`;
    const removeHeader = installContinuationHeader(doc, w, { logo, companyName: company.name, gstin: company.gstin, title: "PAYSLIP", number: ref });

    let y = drawBrandHeader(doc, w, {
      logo,
      company: { ...company, pan: null },
      right: (rx, rw, top) => {
        let ry = put("PAYSLIP", rx, top - 2, { font: F.bold, size: 20, color: T.primary, width: rw, align: "right", spacing: 0.6 });
        ry = put(`For the month of ${month}`, rx, ry, { font: F.medium, size: 8, color: T.muted, width: rw, align: "right" });
        ry = put("Net pay", rx, ry + 10, { size: 7.5, color: T.muted, width: rw, align: "right" });
        return put(cur(input.netPay), rx, ry, { font: F.bold, size: 14, width: rw, align: "right" });
      },
    });

    // Employee + payment cards
    const gap = 12;
    const cardW = (CONTENT_W - gap) / 2;
    const empRows: [string, string][] = [
      ["Employee Code", e.employeeNumber],
      ["Designation", e.designation?.trim() || "—"],
      ["Department", e.department?.trim() || "—"],
      ["Date of Joining", e.dateOfJoining ? fmtDocDate(e.dateOfJoining) : "—"],
      ["PAN", e.pan?.trim() || "—"],
    ];
    const payRows: [string, string][] = [
      ["Pay Period", month],
      ["Days Paid", String(input.daysPaid)],
      ["Account Name", e.bankAccountName?.trim() || "—"],
      ["Account No.", maskAccount(e.bankAccountNo)],
      ["IFSC", e.bankIfsc?.trim() || "—"],
    ];
    const h = Math.max(
      keyValueCard(doc, w, { x: M, y, width: cardW, title: e.displayName, rows: empRows, size: base, draw: false }),
      keyValueCard(doc, w, { x: M + cardW + gap, y, width: cardW, title: "Payment Details", rows: payRows, size: base, draw: false }),
    );
    keyValueCard(doc, w, { x: M, y, width: cardW, title: e.displayName, rows: empRows, size: base, fill: T.soft, minH: h });
    keyValueCard(doc, w, { x: M + cardW + gap, y, width: cardW, title: "Payment Details", rows: payRows, size: base, minH: h });
    y += h + 18;

    // Earnings | Deductions
    const colW = cardW;
    const headH = 24;
    const rowH = base + 11;
    const rows = Math.max(input.earnings.length, input.deductions.length, 1);
    y = ensureSpace(y, headH + rows * rowH + rowH + 60);
    const table = (x: number, title: string, items: { name: string; amount: number }[], totalLabel: string, total: number) => {
      doc.save().rect(x, y, colW, headH).fill(T.tableHead).restore();
      put(title.toUpperCase(), x + 10, y + 8.5, { font: F.semibold, size: 6.8, color: T.primaryDark, spacing: 0.4, width: colW / 2 });
      put("AMOUNT (INR)", x + colW / 2, y + 8.5, { font: F.semibold, size: 6.8, color: T.primaryDark, spacing: 0.4, width: colW / 2 - 10, align: "right" });
      let ry = y + headH;
      for (let i = 0; i < rows; i++) {
        const it = items[i];
        if (i % 2 === 1) doc.save().rect(x, ry, colW, rowH).fill(T.stripe).restore();
        if (it) {
          put(it.name, x + 10, ry + 5.5, { size: base - 0.5, width: colW - 110, oneLine: true });
          put(money(it.amount), x + colW - 100, ry + 5.5, { size: base - 0.5, width: 90, align: "right" });
        }
        ry += rowH;
        hline(x, x + colW, ry, T.line, 0.4);
      }
      put(totalLabel, x + 10, ry + 6, { font: F.semibold, size: base - 0.5, width: colW - 110 });
      put(money(total), x + colW - 100, ry + 6, { font: F.semibold, size: base - 0.5, width: 90, align: "right" });
      hline(x, x + colW, ry + rowH + 2, T.tableBorder, 1);
      return ry + rowH + 2;
    };
    const endL = table(M, "Earnings", input.earnings, "Gross Earnings", input.gross);
    const endR = table(M + cardW + gap, "Deductions", input.deductions, "Total Deductions", input.totalDeductions);
    y = Math.max(endL, endR) + 16;

    // Net pay band
    const words = amountInWords(input.netPay);
    const bandH = 30 + measure(words, F.medium, base - 1, CONTENT_W - 220);
    y = ensureSpace(y, bandH + 10);
    doc.save().roundedRect(M, y, CONTENT_W, bandH, 6).fill(T.primary).restore();
    put("NET PAY", M + 14, y + 10, { font: F.semibold, size: 7, color: "#ffffff", spacing: 0.8 });
    put(words, M + 14, y + 22, { font: F.medium, size: base - 1, color: "#ffffff", width: CONTENT_W - 220 });
    put(cur(input.netPay), RIGHT - 200, y + bandH / 2 - 9, { font: F.bold, size: 16, color: "#ffffff", width: 186, align: "right" });
    put("Gross − Deductions", RIGHT - 200, y + bandH / 2 + 9, { size: 7, color: "#ffffff", width: 186, align: "right" });
    y += bandH + 10;
    if (e.bankAccountNo?.trim()) {
      put(`Net pay of ${cur(input.netPay)} is credited to account ${maskAccount(e.bankAccountNo)} by bank transfer.`, M, y, {
        size: base - 1,
        color: T.muted,
        width: CONTENT_W,
      });
      y = doc.y;
    }
    y += 18;

    // Leave summary
    if (input.leaveLines.length > 0) {
      const cols = [
        { label: "Leave Type", w: CONTENT_W * 0.32, align: "left" as const },
        { label: "Allotted", w: CONTENT_W * 0.17, align: "right" as const },
        { label: "Availed", w: CONTENT_W * 0.17, align: "right" as const },
        { label: "Taken YTD", w: CONTENT_W * 0.17, align: "right" as const },
        { label: "Balance", w: CONTENT_W * 0.17, align: "right" as const },
      ];
      y = ensureSpace(y, 30 + headH + (input.leaveLines.length + 1) * rowH);
      label("Leave Summary", M, y);
      y += 14;
      doc.save().rect(M, y, CONTENT_W, headH).fill(T.tableHead).restore();
      let cx = M;
      for (const c of cols) {
        put(c.label.toUpperCase(), cx + 10, y + 8.5, { font: F.semibold, size: 6.8, color: T.primaryDark, width: c.w - 20, align: c.align, spacing: 0.4 });
        cx += c.w;
      }
      y += headH;
      input.leaveLines.forEach((l, i) => {
        if (i % 2 === 1) doc.save().rect(M, y, CONTENT_W, rowH).fill(T.stripe).restore();
        const vals = [l.name, String(l.alloted), String(l.availed), String(l.takenYtd), String(l.balance)];
        cx = M;
        cols.forEach((c, ci) => {
          put(vals[ci]!, cx + 10, y + 5.5, { size: base - 0.5, width: c.w - 20, align: c.align, oneLine: true, font: ci === 4 ? F.semibold : F.regular });
          cx += c.w;
        });
        y += rowH;
        hline(M, RIGHT, y, T.line, 0.4);
      });
    }

    removeHeader();
    stampPageChrome(doc, w, {
      identity: [company.name, company.gstin ? `GSTIN ${company.gstin}` : ""].filter(Boolean).join("  ·  "),
      footerNote: "Computer-generated; no signature required.",
      reference: ref,
    });
  });
}
