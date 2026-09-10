import type { OrganizationSettings } from "@prisma/client";

/** Client + API shape for workspace module toggles (tenant = user until multi-org). */
export type OrganizationModuleSettingsDTO = {
  quotesEnabled: boolean;
  deliveryChallanEnabled: boolean;
  recurringInvoiceEnabled: boolean;
  creditNoteEnabled: boolean;
  paymentLinksEnabled: boolean;
  purchaseOrderEnabled: boolean;
  recurringExpenseEnabled: boolean;
  recurringBillsEnabled: boolean;
  vendorCreditEnabled: boolean;
  manualJournalEnabled: boolean;
  recurringJournalEnabled: boolean;
  fixedAssetsEnabled: boolean;
  timeTrackingEnabled: boolean;
  tasksEnabled: boolean;
  payrollEnabled: boolean;
  inventoryEnabled: boolean;
  warehousesEnabled: boolean;
  batchTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  ocrEnabled: boolean;
  tallyEnabled: boolean;
  zohoBooksEnabled: boolean;
  quickbooksEnabled: boolean;
};

export const DEFAULT_ORGANIZATION_MODULE_SETTINGS: OrganizationModuleSettingsDTO = {
  quotesEnabled: true,
  deliveryChallanEnabled: true,
  recurringInvoiceEnabled: true,
  creditNoteEnabled: true,
  paymentLinksEnabled: true,
  purchaseOrderEnabled: true,
  recurringExpenseEnabled: true,
  recurringBillsEnabled: true,
  vendorCreditEnabled: true,
  manualJournalEnabled: true,
  recurringJournalEnabled: true,
  fixedAssetsEnabled: true,
  timeTrackingEnabled: true,
  tasksEnabled: true,
  payrollEnabled: true,
  inventoryEnabled: true,
  warehousesEnabled: true,
  batchTrackingEnabled: true,
  serialTrackingEnabled: true,
  ocrEnabled: true,
  tallyEnabled: true,
  zohoBooksEnabled: true,
  quickbooksEnabled: true,
};

export function rowToModuleSettings(row: OrganizationSettings): OrganizationModuleSettingsDTO {
  return {
    quotesEnabled: row.quotesEnabled,
    deliveryChallanEnabled: row.deliveryChallanEnabled,
    recurringInvoiceEnabled: row.recurringInvoiceEnabled,
    creditNoteEnabled: row.creditNoteEnabled,
    paymentLinksEnabled: row.paymentLinksEnabled,
    purchaseOrderEnabled: row.purchaseOrderEnabled,
    recurringExpenseEnabled: row.recurringExpenseEnabled,
    recurringBillsEnabled: row.recurringBillsEnabled,
    vendorCreditEnabled: row.vendorCreditEnabled,
    manualJournalEnabled: row.manualJournalEnabled,
    recurringJournalEnabled: row.recurringJournalEnabled,
    fixedAssetsEnabled: row.fixedAssetsEnabled,
    timeTrackingEnabled: row.timeTrackingEnabled,
    tasksEnabled: row.tasksEnabled,
    payrollEnabled: row.payrollEnabled,
    inventoryEnabled: row.inventoryEnabled,
    warehousesEnabled: row.warehousesEnabled,
    batchTrackingEnabled: row.batchTrackingEnabled,
    serialTrackingEnabled: row.serialTrackingEnabled,
    ocrEnabled: row.ocrEnabled,
    tallyEnabled: row.tallyEnabled,
    zohoBooksEnabled: row.zohoBooksEnabled,
    quickbooksEnabled: row.quickbooksEnabled,
  };
}

/** Inventory off forces dependent stock features off for API/UI consistency. */
export function applyModuleDependencies(s: OrganizationModuleSettingsDTO): OrganizationModuleSettingsDTO {
  const next = { ...s };
  if (!next.inventoryEnabled) {
    next.warehousesEnabled = false;
    next.batchTrackingEnabled = false;
    next.serialTrackingEnabled = false;
  }
  return next;
}

export type ModuleFeatureKey = keyof OrganizationModuleSettingsDTO;

type PathRule = { prefix: string; required: ModuleFeatureKey[] };

/** Longer prefixes first — first match wins. */
const DASHBOARD_MODULE_PATH_RULES: PathRule[] = (
  [
    { prefix: "/dashboard/inventory/warehouses", required: ["inventoryEnabled", "warehousesEnabled"] },
    { prefix: "/dashboard/inventory", required: ["inventoryEnabled"] },
    { prefix: "/dashboard/sales/delivery-challans", required: ["deliveryChallanEnabled"] },
    { prefix: "/dashboard/sales/payment-links", required: ["paymentLinksEnabled"] },
    { prefix: "/dashboard/sales/recurring-invoices", required: ["recurringInvoiceEnabled"] },
    { prefix: "/dashboard/sales/credit-notes", required: ["creditNoteEnabled"] },
    { prefix: "/dashboard/sales/quotes", required: ["quotesEnabled"] },
    { prefix: "/dashboard/purchases/purchase-orders", required: ["purchaseOrderEnabled"] },
    { prefix: "/dashboard/purchases/recurring-expenses", required: ["recurringExpenseEnabled"] },
    { prefix: "/dashboard/purchases/recurring-bills", required: ["recurringBillsEnabled"] },
    { prefix: "/dashboard/purchases/vendor-credits", required: ["vendorCreditEnabled"] },
    { prefix: "/dashboard/accounting/manual-journal", required: ["manualJournalEnabled"] },
    { prefix: "/dashboard/accounting/recurring-journals", required: ["recurringJournalEnabled"] },
    { prefix: "/dashboard/accounting/fixed-assets", required: ["fixedAssetsEnabled"] },
    { prefix: "/dashboard/accounting/depreciation", required: ["fixedAssetsEnabled"] },
    { prefix: "/dashboard/reports/fixed-asset-register", required: ["fixedAssetsEnabled"] },
    { prefix: "/dashboard/reports/depreciation-schedule", required: ["fixedAssetsEnabled"] },
    { prefix: "/dashboard/reports/asset-disposals", required: ["fixedAssetsEnabled"] },
    { prefix: "/dashboard/time-tracking", required: ["timeTrackingEnabled"] },
    { prefix: "/dashboard/tasks", required: ["tasksEnabled"] },
    { prefix: "/dashboard/hr/payroll", required: ["payrollEnabled"] },
    { prefix: "/dashboard/documents", required: ["ocrEnabled"] },
    { prefix: "/dashboard/integrations/tally", required: ["tallyEnabled"] },
    { prefix: "/dashboard/integrations/zoho-books", required: ["zohoBooksEnabled"] },
    { prefix: "/dashboard/integrations/quickbooks", required: ["quickbooksEnabled"] },
  ] satisfies PathRule[]
).sort((a, b) => b.prefix.length - a.prefix.length);

const EXEMPT_PATH_PREFIXES = [
  "/dashboard/settings/general",
  "/settings/general",
  "/login",
];

export function isDashboardPathExemptFromModuleGate(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return EXEMPT_PATH_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

/** True if path is allowed given effective settings (dependencies already applied). */
export function isDashboardPathAllowedForModules(pathname: string, effective: OrganizationModuleSettingsDTO): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (!p.startsWith("/dashboard")) return true;
  if (isDashboardPathExemptFromModuleGate(p)) return true;
  for (const rule of DASHBOARD_MODULE_PATH_RULES) {
    if (p === rule.prefix || p.startsWith(`${rule.prefix}/`)) {
      return rule.required.every((k) => effective[k]);
    }
  }
  return true;
}

export type ApiModuleGuard =
  | "quotes"
  | "delivery_challan"
  | "recurring_invoice"
  | "credit_note"
  | "payment_links"
  | "purchase_order"
  | "recurring_expense"
  | "recurring_bills"
  | "vendor_credit"
  | "manual_journal"
  | "recurring_journal"
  | "fixed_assets"
  | "time_tracking"
  | "tasks"
  | "payroll"
  | "inventory"
  | "warehouses"
  | "ocr"
  | "tally"
  | "zoho_books"
  | "quickbooks";

const API_GUARD_TO_KEYS: Record<ApiModuleGuard, ModuleFeatureKey[]> = {
  quotes: ["quotesEnabled"],
  delivery_challan: ["deliveryChallanEnabled"],
  recurring_invoice: ["recurringInvoiceEnabled"],
  credit_note: ["creditNoteEnabled"],
  payment_links: ["paymentLinksEnabled"],
  purchase_order: ["purchaseOrderEnabled"],
  recurring_expense: ["recurringExpenseEnabled"],
  recurring_bills: ["recurringBillsEnabled"],
  vendor_credit: ["vendorCreditEnabled"],
  manual_journal: ["manualJournalEnabled"],
  recurring_journal: ["recurringJournalEnabled"],
  fixed_assets: ["fixedAssetsEnabled"],
  time_tracking: ["timeTrackingEnabled"],
  tasks: ["tasksEnabled"],
  payroll: ["payrollEnabled"],
  inventory: ["inventoryEnabled"],
  warehouses: ["inventoryEnabled", "warehousesEnabled"],
  ocr: ["ocrEnabled"],
  tally: ["tallyEnabled"],
  zoho_books: ["zohoBooksEnabled"],
  quickbooks: ["quickbooksEnabled"],
};

export function apiGuardsSatisfied(effective: OrganizationModuleSettingsDTO, ...guards: ApiModuleGuard[]): boolean {
  for (const g of guards) {
    const keys = API_GUARD_TO_KEYS[g];
    if (!keys.every((k) => effective[k])) return false;
  }
  return true;
}
