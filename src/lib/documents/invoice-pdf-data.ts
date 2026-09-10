import type { CompanyProfile, Customer, Invoice, InvoiceLine } from "@prisma/client";

export type InvoicePdfPayload = {
  invoice: Invoice & {
    lines: InvoiceLine[];
    customer: Customer;
  };
  company: Pick<CompanyProfile, "companyName" | "gstin" | "billingStreet" | "billingCity" | "billingState" | "billingZip" | "billingCountry" | "logoUrl"> | null;
};

export function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
