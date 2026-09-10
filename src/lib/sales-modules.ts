import { SALES_MODULES } from "@/lib/dashboard-nav";
import type { OrganizationModuleSettingsDTO } from "@/lib/organization-module-settings";

/** Same visibility rules as `DashboardSidebar` sales submenu. */
export function salesModulesForSettings(settings: OrganizationModuleSettingsDTO) {
  return SALES_MODULES.filter((m) => {
    if (m.slug === "quotes") return settings.quotesEnabled;
    if (m.slug === "delivery-challans") return settings.deliveryChallanEnabled;
    if (m.slug === "recurring-invoices") return settings.recurringInvoiceEnabled;
    if (m.slug === "credit-notes") return settings.creditNoteEnabled;
    if (m.slug === "payment-links") return settings.paymentLinksEnabled;
    return true;
  });
}
