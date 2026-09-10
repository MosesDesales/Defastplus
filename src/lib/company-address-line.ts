import type { CompanyProfile } from "@prisma/client";

export function companyAddressOneLine(
  row: Pick<CompanyProfile, "billingStreet" | "billingCity" | "billingState" | "billingZip" | "billingCountry"> | null,
): string | null {
  if (!row) return null;
  const line = [row.billingStreet, row.billingCity, row.billingState, row.billingZip, row.billingCountry].filter(Boolean).join(", ");
  return line || null;
}
