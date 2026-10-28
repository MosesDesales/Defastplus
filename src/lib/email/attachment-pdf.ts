import { prisma } from "@/lib/prisma";
import { buildBusinessDocumentPdf } from "@/lib/pdf/business-document-pdf";
import { buildPayslipPdfBuffer } from "@/lib/pdf/payslip-pdf";
import { loadCompanyForUser } from "@/lib/documents/load-invoice-document";
import {
  loadBillBusinessDocument,
  loadCreditNoteBusinessDocument,
  loadExpenseBusinessDocument,
  loadInvoiceBusinessDocument,
  loadQuoteBusinessDocument,
} from "@/lib/documents/load-business-document";

export type AttachmentKind = "invoice" | "quote" | "bill" | "expense" | "credit-note" | "payslip";

export async function buildAttachmentPdf(
  userId: string,
  kind: AttachmentKind,
  id: string,
): Promise<{ filename: string; buffer: Buffer } | null> {
  const loaders = {
    invoice: loadInvoiceBusinessDocument,
    quote: loadQuoteBusinessDocument,
    bill: loadBillBusinessDocument,
    expense: loadExpenseBusinessDocument,
    "credit-note": loadCreditNoteBusinessDocument,
  } as const;
  if (kind in loaders) {
    const loaded = await loaders[kind as keyof typeof loaders](userId, id);
    if (!loaded) return null;
    return { filename: loaded.filename, buffer: await buildBusinessDocumentPdf(loaded.doc) };
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
      company,
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
