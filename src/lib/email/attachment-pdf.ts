import { prisma } from "@/lib/prisma";
import { parseTemplateConfigJson } from "@/lib/document-template-types";
import { buildInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import { buildPayslipPdfBuffer } from "@/lib/pdf/payslip-pdf";
import { loadCompanyForUser, loadInvoiceDocument } from "@/lib/documents/load-invoice-document";

export type AttachmentKind = "invoice" | "quote" | "bill" | "expense" | "credit-note" | "payslip";

export async function buildAttachmentPdf(
  userId: string,
  kind: AttachmentKind,
  id: string,
): Promise<{ filename: string; buffer: Buffer } | null> {
  if (kind === "invoice") {
    const inv = await loadInvoiceDocument(userId, id);
    if (!inv) return null;
    const company = await loadCompanyForUser(userId);
    const tpl = inv.documentTemplate?.configJson
      ? parseTemplateConfigJson(inv.documentTemplate.configJson)
      : null;
    const buffer = await buildInvoicePdfBuffer({ invoice: inv, company }, { template: tpl });
    return { filename: `Invoice-${inv.invoiceNumber}.pdf`, buffer };
  }
  if (kind === "quote") {
    const q = await prisma.quote.findFirst({
      where: { id, userId },
      include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!q) return null;
    const rows = q.lines.map((l) => [l.description, Number(l.quantity), Number(l.rate), Number(l.amount)]);
    const buffer = await buildLinesDocumentPdf({
      title: `Quote ${q.quoteNumber}`,
      subtitle: q.customer.displayName,
      meta: [
        ["Date", q.quoteDate.toISOString().slice(0, 10)],
        ["Status", q.status],
        ["Total", Number(q.total).toFixed(2)],
      ],
      columns: ["Description", "Qty", "Rate", "Amount"],
      rows,
    });
    return { filename: `Quote-${q.quoteNumber}.pdf`, buffer };
  }
  if (kind === "bill") {
    const b = await prisma.vendorBill.findFirst({
      where: { id, userId },
      include: { vendor: true, lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!b) return null;
    const rows = b.lines.map((l) => [l.description, Number(l.quantity), Number(l.rate), Number(l.lineTotal)]);
    const buffer = await buildLinesDocumentPdf({
      title: `Bill ${b.billNumber}`,
      subtitle: b.vendor.displayName,
      meta: [
        ["Date", b.billDate.toISOString().slice(0, 10)],
        ["Status", b.status],
        ["Total", Number(b.total).toFixed(2)],
      ],
      columns: ["Description", "Qty", "Rate", "Line total"],
      rows,
    });
    return { filename: `Bill-${b.billNumber}.pdf`, buffer };
  }
  if (kind === "expense") {
    const e = await prisma.purchaseExpense.findFirst({
      where: { id, userId },
      include: { expenseAccount: true, bankAccount: true },
    });
    if (!e) return null;
    const buffer = await buildLinesDocumentPdf({
      title: "Purchase expense",
      subtitle: e.expenseDate.toISOString().slice(0, 10),
      meta: [],
      columns: ["Field", "Value"],
      rows: [
        ["Expense account", `${e.expenseAccount.code} — ${e.expenseAccount.name}`],
        ["Bank", `${e.bankAccount.code} — ${e.bankAccount.name}`],
        ["Amount", Number(e.amount)],
        ["Tax", Number(e.taxAmount)],
        ["Posted", e.journalEntryId ? "Yes" : "No"],
        ["Notes", e.notes?.trim() || "—"],
      ],
    });
    return { filename: `Expense-${e.expenseDate.toISOString().slice(0, 10)}.pdf`, buffer };
  }
  if (kind === "credit-note") {
    const cn = await prisma.creditNote.findFirst({
      where: { id, userId },
      include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!cn) return null;
    const rows = cn.lines.map((l) => [l.description, Number(l.quantity), Number(l.rate), Number(l.lineTotal)]);
    const buffer = await buildLinesDocumentPdf({
      title: `Credit note ${cn.creditNumber}`,
      subtitle: cn.customer.displayName,
      meta: [
        ["Date", cn.issueDate.toISOString().slice(0, 10)],
        ["Status", cn.status],
        ["Total", Number(cn.total).toFixed(2)],
      ],
      columns: ["Description", "Qty", "Rate", "Total"],
      rows,
    });
    return { filename: `CreditNote-${cn.creditNumber}.pdf`, buffer };
  }
  if (kind === "payslip") {
    const p = await prisma.payslip.findFirst({
      where: { id, payrollRun: { userId } },
      include: { employee: true, payrollRun: true },
    });
    if (!p) return null;
    const company = await loadCompanyForUser(userId);
    const lines = (p.breakdown as unknown as { name: string; kind: "EARNING" | "DEDUCTION"; amount: number }[]) ?? [];
    const leaveLines =
      (p.leaveSummary as unknown as { name: string; alloted: number; availed: number; takenYtd: number; balance: number }[]) ?? [];
    const buffer = await buildPayslipPdfBuffer({
      company: company ? { companyName: company.companyName, logoUrl: company.logoUrl } : null,
      employee: {
        displayName: p.employee.displayName,
        employeeNumber: p.employee.employeeNumber,
        department: p.employee.department,
        designation: p.employee.designation,
        dateOfJoining: p.employee.dateOfJoining,
        bankAccountName: p.employee.bankAccountName,
        bankIfsc: p.employee.bankIfsc,
        bankAccountNo: p.employee.bankAccountNo,
        pan: p.employee.pan,
      },
      yearMonth: p.payrollRun.yearMonth,
      daysPaid: Number(p.daysPaid),
      earnings: lines.filter((l) => l.kind === "EARNING").map((l) => ({ name: l.name, amount: l.amount })),
      deductions: lines.filter((l) => l.kind === "DEDUCTION").map((l) => ({ name: l.name, amount: l.amount })),
      gross: Number(p.gross),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      leaveLines,
    });
    return { filename: `Payslip-${p.payrollRun.yearMonth}-${p.employee.employeeNumber}.pdf`, buffer };
  }
  return null;
}
