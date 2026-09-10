import { IntegrationType } from "@prisma/client";

const SLUGS = ["tally", "zoho-books", "quickbooks"] as const;
export type IntegrationSlug = (typeof SLUGS)[number];

export function isIntegrationSlug(s: string): s is IntegrationSlug {
  return (SLUGS as readonly string[]).includes(s);
}

export function slugToType(slug: string): IntegrationType | null {
  switch (slug) {
    case "tally":
      return IntegrationType.TALLY;
    case "zoho-books":
      return IntegrationType.ZOHO_BOOKS;
    case "quickbooks":
      return IntegrationType.QUICKBOOKS;
    default:
      return null;
  }
}

export function typeToSlug(type: IntegrationType): IntegrationSlug {
  switch (type) {
    case IntegrationType.TALLY:
      return "tally";
    case IntegrationType.ZOHO_BOOKS:
      return "zoho-books";
    case IntegrationType.QUICKBOOKS:
      return "quickbooks";
    default:
      return "tally";
  }
}
