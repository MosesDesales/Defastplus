import type { Customer, Invoice, InvoiceLine } from "@prisma/client";
import type { CompanyForDocs } from "@/lib/documents/business-document";

export type InvoicePdfPayload = {
  invoice: Invoice & {
    lines: (InvoiceLine & { item?: { hsnCode: string | null; unit: string } | null })[];
    customer: Customer;
  };
  company: CompanyForDocs | null;
};

export function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
