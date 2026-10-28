import { prisma } from "@/lib/prisma";
import { parseTemplateConfigJson, type DocumentTemplateConfig, type DocumentTemplateTypeSlug } from "@/lib/document-template-types";
import { getDefaultTemplateId } from "@/lib/document-templates-service";
import {
  billToDocument,
  creditNoteToDocument,
  expenseToDocument,
  invoiceToDocument,
  quoteToDocument,
  type BusinessDocument,
} from "@/lib/documents/business-document";
import { loadCompanyForUser, loadInvoiceDocument } from "@/lib/documents/load-invoice-document";

/**
 * One loader per document type, shared by the PDF download routes, email attachments and
 * on-screen previews so all three always show the same document.
 */

const itemSelect = { item: { select: { hsnCode: true, unit: true } } } as const;

async function moduleDefaultTemplate(userId: string, type: DocumentTemplateTypeSlug): Promise<DocumentTemplateConfig | null> {
  const id = await getDefaultTemplateId(prisma, userId, type);
  if (!id) return null;
  const t = await prisma.documentTemplate.findFirst({ where: { id, userId }, select: { configJson: true } });
  return t ? parseTemplateConfigJson(t.configJson) : null;
}

export type LoadedDocument = { doc: BusinessDocument; filename: string };

export async function loadInvoiceBusinessDocument(userId: string, id: string, overrideTemplateId?: string | null): Promise<LoadedDocument | null> {
  const inv = await loadInvoiceDocument(userId, id);
  if (!inv) return null;
  let template = inv.documentTemplate?.configJson ? parseTemplateConfigJson(inv.documentTemplate.configJson) : null;
  if (overrideTemplateId) {
    const t = await prisma.documentTemplate.findFirst({
      where: {
        id: overrideTemplateId,
        userId,
        OR: [{ moduleMaps: { some: { moduleName: "invoices" } } }, { AND: [{ type: "invoices" }, { moduleMaps: { none: {} } }] }],
      },
    });
    if (t) template = parseTemplateConfigJson(t.configJson);
  }
  const company = await loadCompanyForUser(userId);
  return { doc: invoiceToDocument(inv, company, template), filename: `Invoice-${inv.invoiceNumber}.pdf` };
}

export async function loadQuoteBusinessDocument(userId: string, id: string): Promise<LoadedDocument | null> {
  const q = await prisma.quote.findFirst({
    where: { id, userId },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" }, include: itemSelect } },
  });
  if (!q) return null;
  const [company, template] = await Promise.all([loadCompanyForUser(userId), moduleDefaultTemplate(userId, "quotes")]);
  return { doc: quoteToDocument(q, company, template), filename: `Quote-${q.quoteNumber}.pdf` };
}

export async function loadCreditNoteBusinessDocument(userId: string, id: string): Promise<LoadedDocument | null> {
  const cn = await prisma.creditNote.findFirst({
    where: { id, userId },
    include: {
      customer: true,
      invoice: { select: { invoiceNumber: true, issueDate: true } },
      lines: { orderBy: { sortOrder: "asc" }, include: itemSelect },
    },
  });
  if (!cn) return null;
  const [company, template] = await Promise.all([loadCompanyForUser(userId), moduleDefaultTemplate(userId, "credit-notes")]);
  return { doc: creditNoteToDocument(cn, company, template), filename: `CreditNote-${cn.creditNumber}.pdf` };
}

export async function loadBillBusinessDocument(userId: string, id: string): Promise<LoadedDocument | null> {
  const b = await prisma.vendorBill.findFirst({
    where: { id, userId },
    include: { vendor: true, lines: { orderBy: { sortOrder: "asc" }, include: itemSelect } },
  });
  if (!b) return null;
  const [company, template] = await Promise.all([loadCompanyForUser(userId), moduleDefaultTemplate(userId, "bills")]);
  return { doc: billToDocument(b, company, template), filename: `Bill-${b.billNumber}.pdf` };
}

export async function loadExpenseBusinessDocument(userId: string, id: string): Promise<LoadedDocument | null> {
  const e = await prisma.purchaseExpense.findFirst({
    where: { id, userId },
    include: { expenseAccount: true, bankAccount: true, vendor: true },
  });
  if (!e) return null;
  const company = await loadCompanyForUser(userId);
  return { doc: expenseToDocument(e, company), filename: `Expense-${e.expenseDate.toISOString().slice(0, 10)}.pdf` };
}
