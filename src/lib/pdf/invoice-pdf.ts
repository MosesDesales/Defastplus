import type { InvoicePdfPayload } from "@/lib/documents/invoice-pdf-data";
import type { DocumentTemplateConfig } from "@/lib/document-template-types";
import { invoiceToDocument } from "@/lib/documents/business-document";
import { buildBusinessDocumentPdf } from "@/lib/pdf/business-document-pdf";

export type BuildInvoicePdfOptions = {
  template?: DocumentTemplateConfig | null;
};

/** Tax invoice PDF — same layout as quotes, credit notes and bills (see business-document-pdf). */
export async function buildInvoicePdfBuffer(data: InvoicePdfPayload, options?: BuildInvoicePdfOptions): Promise<Buffer> {
  return buildBusinessDocumentPdf(invoiceToDocument(data.invoice, data.company, options?.template ?? null));
}
