import { logoBufferFromUrl } from "@/lib/pdf/logo-image-buffer";
import { pdfBufferFromDoc } from "@/lib/pdf/simple-pdf";

const ACCENT = "#f0a8a0";
const BORDER = "#1a1a1a";
const TEXT = "#111111";

export type PayslipPdfInput = {
  company: { companyName: string | null; logoUrl: string | null } | null;
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

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function monthLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]}-${y}`;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildPayslipPdfBuffer(input: PayslipPdfInput): Promise<Buffer> {
  const logoBuf = input.company?.logoUrl ? await logoBufferFromUrl(input.company.logoUrl) : null;

  return pdfBufferFromDoc((doc) => {
    const margin = doc.page.margins.left;
    const pageW = doc.page.width;
    const contentW = pageW - margin * 2;
    const rightX = pageW - margin;
    const half = contentW / 2;

    // —— Header: company name (left) + centered title + logo (right)
    doc.font("Helvetica-Bold").fontSize(15).fillColor(TEXT).text(input.company?.companyName ?? "Company", margin, margin, { width: contentW - 100 });
    doc.font("Helvetica-Bold").fontSize(13).text(`Payslip ${monthLabel(input.yearMonth)}`, margin, margin + 22, { width: contentW, align: "center" });
    if (logoBuf) {
      try {
        doc.image(logoBuf, rightX - 90, margin - 4, { width: 90, height: 40, fit: [90, 40] });
      } catch {
        /* skip broken logo */
      }
    }
    doc.y = margin + 50;

    // —— Employee name banner
    const nameLineY = doc.y;
    const nameLineH = 26;
    doc.lineWidth(1).strokeColor(BORDER).rect(margin, nameLineY, contentW, nameLineH).stroke();
    const subLine = input.employee.department?.trim();
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(TEXT)
      .text(`${input.employee.displayName}${subLine ? ` : ${subLine}` : ""}`, margin + 8, nameLineY + 8);
    doc.y = nameLineY + nameLineH;

    // —— Employee Details / Payment Details grid
    let y = doc.y;
    const headerH = 20;
    doc.rect(margin, y, contentW, headerH).fill(ACCENT);
    doc.lineWidth(1).strokeColor(BORDER);
    doc.rect(margin, y, contentW, headerH).stroke();
    doc.moveTo(margin + half, y).lineTo(margin + half, y + headerH).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT);
    doc.text("Employee Details", margin + 6, y + 5);
    doc.text("Payment Details", margin + half + 6, y + 5);
    y += headerH;

    const bankLabel = input.employee.bankAccountName
      ? `${input.employee.bankAccountName}${input.employee.bankIfsc ? `\nIFSC Code: ${input.employee.bankIfsc}` : ""}`
      : "—";

    const empRows: [string, string][] = [
      ["Employee Code.", input.employee.employeeNumber],
      ["Designation", input.employee.designation ?? "—"],
      ["Department", input.employee.department ?? "—"],
      ["Date of joining", input.employee.dateOfJoining ? input.employee.dateOfJoining.toISOString().slice(0, 10) : "—"],
    ];
    const payRows: [string, string][] = [
      ["Bank Name & Branch", bankLabel],
      ["Bank A/c No.", input.employee.bankAccountNo ?? "—"],
      ["PAN NO.", input.employee.pan ?? "—"],
      ["Days Paid", fmt(input.daysPaid)],
    ];

    const labelW = half * 0.42;
    const valueW = half - labelW - 12;
    for (let i = 0; i < 4; i++) {
      const [el, ev] = empRows[i]!;
      const [pl, pv] = payRows[i]!;
      const lineCount = Math.max(ev.split("\n").length, pv.split("\n").length);
      const rh = Math.max(20, lineCount * 10 + 10);

      doc.rect(margin, y, half, rh).stroke();
      doc.rect(margin + half, y, half, rh).stroke();

      doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT).text(el, margin + 6, y + 6, { width: labelW });
      doc.font("Helvetica").fontSize(8).text(ev, margin + 6 + labelW, y + 6, { width: valueW });
      doc.font("Helvetica-Bold").fontSize(8).text(pl, margin + half + 6, y + 6, { width: labelW });
      doc.font("Helvetica").fontSize(8).text(pv, margin + half + 6 + labelW, y + 6, { width: valueW });

      y += rh;
    }

    doc.y = y + 14;

    // —— Earnings / Deductions grid
    y = doc.y;
    doc.rect(margin, y, contentW, headerH).fill(ACCENT);
    doc.rect(margin, y, contentW, headerH).stroke();
    doc.moveTo(margin + half, y).lineTo(margin + half, y + headerH).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT);
    doc.text("Earnings", margin + 6, y + 5, { width: half - 60 });
    doc.text("INR", margin, y + 5, { width: half - 8, align: "right" });
    doc.text("Deductions", margin + half + 6, y + 5, { width: half - 60 });
    doc.text("INR", margin + half, y + 5, { width: half - 8, align: "right" });
    y += headerH;

    const rowCount = Math.max(input.earnings.length, input.deductions.length, 1);
    const lineH = 16;
    for (let i = 0; i < rowCount; i++) {
      const e = input.earnings[i];
      const d = input.deductions[i];
      doc.rect(margin, y, half, lineH).stroke();
      doc.rect(margin + half, y, half, lineH).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(TEXT);
      if (e) {
        doc.text(e.name, margin + 6, y + 4, { width: half - 90 });
        doc.text(fmt(e.amount), margin, y + 4, { width: half - 8, align: "right" });
      }
      if (d) {
        doc.text(d.name, margin + half + 6, y + 4, { width: half - 90 });
        doc.text(fmt(d.amount), margin + half, y + 4, { width: half - 8, align: "right" });
      }
      y += lineH;
    }

    // Totals row
    doc.rect(margin, y, half, lineH).stroke();
    doc.rect(margin + half, y, half, lineH).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT);
    doc.text("Total Earnings", margin + 6, y + 4, { width: half - 90 });
    doc.text(fmt(input.gross), margin, y + 4, { width: half - 8, align: "right" });
    doc.text("Total Deductions", margin + half + 6, y + 4, { width: half - 90 });
    doc.text(fmt(input.totalDeductions), margin + half, y + 4, { width: half - 8, align: "right" });
    y += lineH;

    // Net pay row (highlighted, left column only, matching the reference layout)
    const netH = 22;
    doc.rect(margin, y, half, netH).fill(ACCENT);
    doc.rect(margin, y, half, netH).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT);
    doc.text("Net Pay (INR)", margin + 6, y + 5, { width: half - 90 });
    doc.text(fmt(input.netPay), margin, y + 5, { width: half - 8, align: "right" });
    y += netH;

    doc.y = y + 14;

    // —— Deposit statement
    const bankName = input.employee.bankAccountName ?? "your bank";
    const statementY = doc.y;
    const statementText = `Net Pay of INR ${fmt(input.netPay)} is payable to your ${bankName} account by bank transfer.`;
    const statementH = doc.heightOfString(statementText, { width: contentW - 16 }) + 16;
    doc.rect(margin, statementY, contentW, statementH).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT).text(statementText, margin + 8, statementY + 8, { width: contentW - 16 });
    doc.y = statementY + statementH + 14;

    // —— Leave table
    if (input.leaveLines.length > 0) {
      const cols = [
        { label: "Leave Name", w: contentW * 0.28, align: "left" as const },
        { label: "Leave Alloted", w: contentW * 0.18, align: "right" as const },
        { label: "Leave Availed", w: contentW * 0.18, align: "right" as const },
        { label: "Leave Taken YTD", w: contentW * 0.18, align: "right" as const },
        { label: "Leave Balance", w: contentW * 0.18, align: "right" as const },
      ];
      y = doc.y;
      doc.rect(margin, y, contentW, headerH).fill(ACCENT);
      let cx = margin;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT);
      for (const c of cols) {
        doc.rect(cx, y, c.w, headerH).stroke();
        doc.text(c.label, cx + 4, y + 6, { width: c.w - 8, align: c.align });
        cx += c.w;
      }
      y += headerH;

      doc.font("Helvetica").fontSize(8);
      for (const line of input.leaveLines) {
        cx = margin;
        const values = [line.name, fmt(line.alloted), fmt(line.availed), fmt(line.takenYtd), fmt(line.balance)];
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i]!;
          doc.rect(cx, y, c.w, lineH).stroke();
          doc.text(values[i]!, cx + 4, y + 4, { width: c.w - 8, align: c.align });
          cx += c.w;
        }
        y += lineH;
      }
      doc.y = y;
    }
  });
}
