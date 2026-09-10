import type { OcrDocumentType, OcrExtractedDocument } from "@/lib/ocr/types";
import { prisma } from "@/lib/prisma";

export async function attachDuplicateHints(
  userId: string,
  documentType: OcrDocumentType,
  extracted: OcrExtractedDocument,
): Promise<OcrExtractedDocument> {
  const inv = extracted.invoiceNo?.trim();
  if (!inv) return extracted;

  if (documentType === "INVOICE") {
    const row = await prisma.invoice.findFirst({
      where: { userId, invoiceNumber: inv },
      select: { id: true },
    });
    if (row) {
      return {
        ...extracted,
        meta: { ...extracted.meta, duplicateInvoiceId: row.id },
        warnings: [...extracted.warnings, `An invoice with number ${inv} already exists — avoid duplicates.`],
      };
    }
  }

  if (documentType === "BILL") {
    const row = await prisma.vendorBill.findFirst({
      where: { userId, billNumber: inv },
      select: { id: true, vendor: { select: { displayName: true, companyName: true } } },
    });
    if (row) {
      const party = extracted.partyName?.trim().toLowerCase() ?? "";
      const vname = (row.vendor.companyName || row.vendor.displayName).trim().toLowerCase();
      const nameMismatch =
        party.length > 4 &&
        vname.length > 4 &&
        !vname.includes(party.slice(0, Math.min(8, party.length))) &&
        !party.includes(vname.slice(0, Math.min(8, vname.length)));
      return {
        ...extracted,
        meta: { ...extracted.meta, duplicateBillNumber: inv },
        warnings: [
          ...extracted.warnings,
          nameMismatch
            ? `Bill number ${inv} is already used for vendor "${row.vendor.companyName || row.vendor.displayName}" — extracted party "${extracted.partyName}" may be a different supplier.`
            : `A bill with number ${inv} may already exist — verify before posting.`,
        ],
      };
    }
  }

  if (documentType === "EXPENSE" && extracted.invoiceDate) {
    const d = extracted.invoiceDate;
    const start = new Date(`${d}T00:00:00.000Z`);
    const end = new Date(`${d}T23:59:59.999Z`);
    const dup = await prisma.purchaseExpense.findFirst({
      where: {
        userId,
        invoiceNumber: inv,
        expenseDate: { gte: start, lte: end },
      },
      select: { id: true },
    });
    if (dup) {
      return {
        ...extracted,
        meta: { ...extracted.meta, duplicateExpenseKey: dup.id },
        warnings: [...extracted.warnings, "A similar expense (same invoice # and date) may already exist."],
      };
    }
  }

  return extracted;
}
