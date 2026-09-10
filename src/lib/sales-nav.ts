import type { SalesSlug } from "@/lib/dashboard-nav";

/** Dedicated Customers UI lives under `/dashboard/sales/customers`; other modules use `/dashboard/sales/[slug]`. */
export function hrefForSalesSlug(slug: SalesSlug): string {
  if (slug === "customers") {
    return "/dashboard/sales/customers";
  }
  if (slug === "quotes") {
    return "/dashboard/sales/quotes";
  }
  if (slug === "invoices") {
    return "/dashboard/sales/invoices";
  }
  if (slug === "payments-received") {
    return "/dashboard/sales/payments-received";
  }
  if (slug === "credit-notes") {
    return "/dashboard/sales/credit-notes";
  }
  if (slug === "recurring-invoices") {
    return "/dashboard/sales/recurring-invoices";
  }
  if (slug === "delivery-challans") {
    return "/dashboard/sales/delivery-challans";
  }
  if (slug === "payment-links") {
    return "/dashboard/sales/payment-links";
  }
  return `/dashboard/sales/${slug}`;
}
