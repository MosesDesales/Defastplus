/**
 * Module registry: the single source of truth for which pages and APIs belong to which
 * assignable module. Used by the proxy (direct URL / API enforcement), the sidebar, and
 * the Super User module-assignment UI. Pure — safe to import from client, server, and proxy.
 *
 * Matching is longest-prefix-wins across every module. A prefix starting with "=" matches
 * that exact path only. Paths not owned by any module are allowed (see EXEMPT_* and the
 * route-coverage test, which fails when a new route is added without being classified).
 */

export type ModuleCategory = "core" | "gst" | "business";

export type ModuleKey =
  | "dashboard"
  | "company"
  | "customers"
  | "suppliers"
  | "sales"
  | "sales_invoices"
  | "quotations"
  | "purchases"
  | "purchase_invoices"
  | "expenses"
  | "inventory"
  | "products_services"
  | "stock_reports"
  | "banking"
  | "bank_reconciliation"
  | "chart_of_accounts"
  | "general_ledger"
  | "manual_journal"
  | "fixed_assets"
  | "trial_balance"
  | "profit_loss"
  | "balance_sheet"
  | "gst_config"
  | "gst_tax_rates"
  | "gst_reconciliation"
  | "gstr3b"
  | "credit_debit_notes"
  | "eway_bill"
  | "employees"
  | "payroll"
  | "tasks"
  | "time_tracking"
  | "ocr"
  | "integrations"
  | "settings";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  category: ModuleCategory;
  description: string;
  /** Always granted; shown locked in the assignment UI. */
  required?: boolean;
  pages: string[];
  apis: string[];
  /**
   * API prefixes whose GET requests stay open to every signed-in tenant, because forms in
   * other modules read them as reference data (e.g. the invoice form lists customers).
   * Pages and write methods remain restricted to the owning module.
   */
  sharedReads?: string[];
};

/** Listed for completeness; no implementation exists in this build, so they cannot be assigned. */
export type UnavailableModule = { label: string; category: ModuleCategory; note: string };

/** Capabilities that are part of another module rather than separately gateable screens. */
export type BundledCapability = { label: string; category: ModuleCategory; providedBy: ModuleKey[]; note: string };

export const MODULES: readonly ModuleDefinition[] = [
  // ── Core accounting ────────────────────────────────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard",
    category: "core",
    description: "Home overview with receivables, payables, and cash summaries.",
    required: true,
    pages: ["=/dashboard"],
    apis: ["/api/dashboard"],
  },
  {
    key: "company",
    label: "Company Management",
    category: "core",
    description: "Organisation profile, address, logo, and company setup.",
    pages: ["/dashboard/settings/profile", "/dashboard/settings/setup"],
    apis: ["/api/settings/company", "/api/settings/profile"],
    sharedReads: ["/api/settings/company", "/api/settings/profile"],
  },
  {
    key: "customers",
    label: "Customer Management",
    category: "core",
    description: "Customer master with GSTIN, billing and shipping addresses.",
    pages: ["/dashboard/sales/customers"],
    apis: ["/api/customers"],
    sharedReads: ["/api/customers"],
  },
  {
    key: "suppliers",
    label: "Supplier Management",
    category: "core",
    description: "Vendor master used on bills, purchase orders, and payments.",
    pages: ["/dashboard/purchases/vendors"],
    apis: ["/api/purchases/vendors"],
    sharedReads: ["/api/purchases/vendors"],
  },
  {
    key: "sales",
    label: "Sales",
    category: "core",
    description: "Payments received, recurring invoices, delivery challans, and sales orders.",
    pages: [
      "/dashboard/sales/payments-received",
      "/dashboard/sales/recurring-invoices",
      "/dashboard/sales/delivery-challans",
      "/dashboard/sales/sales-orders",
      "/dashboard/sales/payment-links",
    ],
    apis: ["/api/payments", "/api/sales/recurring-invoices", "/api/sales/delivery-challans"],
  },
  {
    key: "sales_invoices",
    label: "Sales Invoices (GST-compliant)",
    category: "core",
    description: "Tax invoices with CGST/SGST/IGST split, HSN/SAC, and PDF output.",
    pages: ["/dashboard/sales/invoices"],
    apis: ["/api/invoices"],
    sharedReads: ["/api/invoices"],
  },
  {
    key: "quotations",
    label: "Quotations",
    category: "core",
    description: "Quotes and estimates that convert to invoices.",
    pages: ["/dashboard/sales/quotes", "/dashboard/sales/estimates"],
    apis: ["/api/quotes"],
  },
  {
    key: "purchases",
    label: "Purchases",
    category: "core",
    description: "Purchase orders, payments made, recurring bills, and purchase returns.",
    pages: [
      "/dashboard/purchases/purchase-orders",
      "/dashboard/purchases/payments-made",
      "/dashboard/purchases/recurring-bills",
      "/dashboard/purchases/purchase-returns",
    ],
    apis: [
      "/api/purchases/purchase-orders",
      "/api/purchases/payments",
      "/api/purchases/recurring-bills",
      "/api/purchases/purchase-returns",
      "/api/purchases/dashboard",
    ],
  },
  {
    key: "purchase_invoices",
    label: "Purchase Invoices (GST-compliant)",
    category: "core",
    description: "Vendor bills with input GST captured for ITC.",
    pages: ["/dashboard/purchases/bills"],
    apis: ["/api/purchases/bills"],
    sharedReads: ["/api/purchases/bills"],
  },
  {
    key: "expenses",
    label: "Expenses",
    category: "core",
    description: "Everyday spend and recurring expenses.",
    pages: ["/dashboard/purchases/expenses", "/dashboard/purchases/recurring-expenses"],
    apis: ["/api/purchases/expenses", "/api/purchases/recurring-expenses"],
  },
  {
    key: "inventory",
    label: "Inventory Management",
    category: "core",
    description: "Warehouses, categories, units, and stock adjustments.",
    pages: [
      "/dashboard/inventory/categories",
      "/dashboard/inventory/units",
      "/dashboard/inventory/warehouses",
      "/dashboard/inventory/stock-adjustments",
    ],
    apis: [
      "/api/inventory/categories",
      "/api/inventory/units",
      "/api/inventory/warehouses",
      "/api/inventory/settings",
      "/api/inventory/stock-adjustments",
    ],
    sharedReads: ["/api/inventory/categories", "/api/inventory/units", "/api/inventory/warehouses", "/api/inventory/settings"],
  },
  {
    key: "products_services",
    label: "Products and Services",
    category: "core",
    description: "Item catalogue with HSN/SAC codes, GST rates, and pricing.",
    pages: ["/dashboard/inventory/items", "/dashboard/items"],
    apis: ["/api/inventory/items", "/api/items"],
    sharedReads: ["/api/inventory/items", "/api/items"],
  },
  {
    key: "stock_reports",
    label: "Stock Reports",
    category: "core",
    description: "Inventory valuation by FIFO or weighted average.",
    pages: ["/dashboard/inventory/valuation"],
    apis: ["/api/inventory/valuation"],
  },
  {
    key: "banking",
    label: "Banking",
    category: "core",
    description: "Bank accounts, transactions, and statement import.",
    pages: ["/dashboard/banking"],
    apis: ["/api/banking"],
    sharedReads: ["/api/banking/accounts", "/api/banking/chart-accounts"],
  },
  {
    key: "bank_reconciliation",
    label: "Bank Reconciliation",
    category: "core",
    description: "Match bank lines to invoices, bills, and journals.",
    pages: ["/dashboard/banking/reconciliation"],
    apis: ["/api/banking/reconcile", "/api/banking/suggestions", "/api/banking/open-docs"],
  },
  {
    key: "chart_of_accounts",
    label: "Chart of Accounts",
    category: "core",
    description: "Account hierarchy, codes, and opening balances.",
    pages: ["/dashboard/accounting/chart-of-accounts"],
    apis: ["/api/accounting/accounts"],
    sharedReads: ["/api/accounting/accounts"],
  },
  {
    key: "general_ledger",
    label: "General Ledger",
    category: "core",
    description: "Posted activity and running balances by account.",
    pages: ["/dashboard/accounting/general-ledger"],
    apis: ["/api/accounting/ledger"],
  },
  {
    key: "manual_journal",
    label: "Manual Journal",
    category: "core",
    description: "Double-entry journals and recurring journals.",
    pages: ["/dashboard/accounting/manual-journal", "/dashboard/accounting/recurring-journals", "/dashboard/accountant"],
    apis: ["/api/accounting/journals"],
  },
  {
    key: "fixed_assets",
    label: "Fixed Assets & Depreciation",
    category: "core",
    description: "Asset register, depreciation runs, and disposal reports.",
    pages: [
      "/dashboard/accounting/fixed-assets",
      "/dashboard/accounting/depreciation",
      "/dashboard/reports/fixed-asset-register",
      "/dashboard/reports/depreciation-schedule",
      "/dashboard/reports/asset-disposals",
    ],
    apis: ["/api/accounting/fixed-assets", "/api/accounting/depreciation"],
  },
  {
    key: "trial_balance",
    label: "Trial Balance",
    category: "core",
    description: "Debits and credits by account for a period.",
    pages: ["/dashboard/reports/trial-balance"],
    apis: ["/api/reports/trial-balance"],
  },
  {
    key: "profit_loss",
    label: "Profit and Loss",
    category: "core",
    description: "Income and expenses from posted journals.",
    pages: ["/dashboard/reports/pnl"],
    apis: ["/api/reports/pnl"],
  },
  {
    key: "balance_sheet",
    label: "Balance Sheet",
    category: "core",
    description: "Assets, liabilities, and equity.",
    pages: ["/dashboard/reports/balance-sheet"],
    apis: ["/api/reports/balance-sheet"],
  },

  // ── Indian GST & taxation ──────────────────────────────────────────────────
  {
    key: "gst_config",
    label: "GST Configuration & GSTIN",
    category: "gst",
    description: "GST registration, GSTIN, state of supply, and company tax details.",
    pages: ["/dashboard/settings/taxes/gst"],
    apis: ["/api/settings/gst"],
    sharedReads: ["/api/settings/gst"],
  },
  {
    key: "gst_tax_rates",
    label: "GST Tax Rate Configuration",
    category: "gst",
    description: "Tax-rate settings page (rates and HSN/SAC are maintained per item).",
    pages: ["/dashboard/settings/taxes/tax-rates"],
    apis: [],
  },
  {
    key: "gst_reconciliation",
    label: "GST Reconciliation (GSTR-2A) & ITC",
    category: "gst",
    description: "Match purchase bills against GSTR-2A to support input tax credit claims.",
    pages: ["/dashboard/gst/gstr-2a"],
    apis: ["/api/gst/gstr2a"],
  },
  {
    key: "gstr3b",
    label: "GSTR-3B Reports",
    category: "gst",
    description: "Monthly outward supplies, ITC, and tax payable summary.",
    pages: ["/dashboard/gst/gstr-3b"],
    apis: ["/api/gst/gstr3b"],
  },
  {
    key: "credit_debit_notes",
    label: "Credit Notes and Debit Notes",
    category: "gst",
    description: "Customer credit notes and vendor credits (debit notes).",
    pages: ["/dashboard/sales/credit-notes", "/dashboard/purchases/vendor-credits"],
    apis: ["/api/sales/credit-notes", "/api/purchases/vendor-credits"],
  },
  {
    key: "eway_bill",
    label: "E-Way Bill Integration",
    category: "gst",
    description: "Generate, extend, and cancel e-way bills through the configured GSP.",
    pages: ["/dashboard/gst/eway-bills"],
    apis: ["/api/gst/eway-bills"],
  },

  // ── Other business modules ─────────────────────────────────────────────────
  {
    key: "employees",
    label: "Employee Management",
    category: "business",
    description: "Employee records and leave tracking.",
    pages: ["/dashboard/hr/employees", "/dashboard/hr/leave"],
    apis: ["/api/hr/employees", "/api/hr/leave-entries", "/api/hr/leave-types"],
    sharedReads: ["/api/hr/employees"],
  },
  {
    key: "payroll",
    label: "Payroll",
    category: "business",
    description: "Salary structures, payroll runs, and payslips.",
    pages: ["/dashboard/hr/payroll"],
    apis: ["/api/hr/payroll", "/api/hr/salary-structures"],
  },
  {
    key: "tasks",
    label: "Tasks",
    category: "business",
    description: "Task boards, assignments, and due dates.",
    pages: ["/dashboard/tasks"],
    apis: ["/api/tasks"],
  },
  {
    key: "time_tracking",
    label: "Time Tracking",
    category: "business",
    description: "Projects, timers, timesheets, and billable hours.",
    pages: ["/dashboard/time-tracking"],
    apis: ["/api/time-tracking"],
    sharedReads: ["/api/time-tracking/projects"],
  },
  {
    key: "ocr",
    label: "OCR Data Extraction",
    category: "business",
    description: "Extract GST invoice and receipt data from uploaded documents.",
    pages: ["/dashboard/documents"],
    apis: ["/api/ocr", "/api/purchases/expenses/receipt-ocr"],
  },
  {
    key: "integrations",
    label: "Third-Party Accounting Integrations",
    category: "business",
    description: "Tally, Zoho Books, and QuickBooks connections and migration.",
    pages: ["/dashboard/integrations"],
    apis: ["/api/integrations"],
  },
  {
    key: "settings",
    label: "Settings",
    category: "business",
    description: "Users, roles, currencies, PDF templates, and audit history.",
    pages: ["/dashboard/settings"],
    apis: ["/api/settings", "/api/audit"],
    sharedReads: ["/api/settings"],
  },
];

export const UNAVAILABLE_MODULES: readonly UnavailableModule[] = [
  { label: "Cash Flow Reports", category: "core", note: "No cash-flow statement exists yet." },
  { label: "GSTR-1 Reports and Export", category: "gst", note: "No GSTR-1 report exists yet." },
  { label: "GST Sales and Purchase Registers", category: "gst", note: "No register report exists yet." },
  { label: "E-Invoice Integration (IRN)", category: "gst", note: "No IRP/e-invoice integration exists yet." },
  { label: "TDS/TCS", category: "gst", note: "Only TDS fields on documents; no TDS/TCS module." },
  { label: "Document Management", category: "business", note: "The Documents page is a placeholder." },
  { label: "Payment Integrations", category: "business", note: "Payment links are a placeholder; no gateway is connected." },
];

export const BUNDLED_CAPABILITIES: readonly BundledCapability[] = [
  {
    label: "CGST, SGST and IGST Calculations",
    category: "gst",
    providedBy: ["sales_invoices", "purchase_invoices", "quotations"],
    note: "Calculated on every taxable document; not separately switchable.",
  },
  {
    label: "Intra-state and Inter-state GST Handling",
    category: "gst",
    providedBy: ["sales_invoices", "purchase_invoices", "gst_config"],
    note: "Place of supply decides CGST+SGST vs IGST.",
  },
  {
    label: "HSN and SAC Codes",
    category: "gst",
    providedBy: ["products_services"],
    note: "Maintained on each item.",
  },
  {
    label: "Input Tax Credit (ITC) Tracking",
    category: "gst",
    providedBy: ["gst_reconciliation", "gstr3b"],
    note: "ITC is reported in GSTR-2A reconciliation and GSTR-3B.",
  },
  {
    label: "Reports",
    category: "business",
    providedBy: ["trial_balance", "profit_loss", "balance_sheet", "fixed_assets"],
    note: "The Reports hub shows the reports a user is assigned.",
  },
];

export const ALL_MODULE_KEYS: readonly ModuleKey[] = MODULES.map((m) => m.key);
export const REQUIRED_MODULE_KEYS: readonly ModuleKey[] = MODULES.filter((m) => m.required).map((m) => m.key);

const MODULE_BY_KEY = new Map<string, ModuleDefinition>(MODULES.map((m) => [m.key, m]));

export function isModuleKey(k: string): k is ModuleKey {
  return MODULE_BY_KEY.has(k);
}

export function moduleLabel(k: string): string {
  return MODULE_BY_KEY.get(k)?.label ?? k;
}

/** Pages every signed-in user may open regardless of assignment. */
const EXEMPT_PAGES = [
  // Workspace module toggles; already exempt from the org-level module gate.
  "/dashboard/settings/general",
];

/** APIs outside module control: auth, scheduled jobs (CRON_SECRET), shared services, and Super User APIs (own guard). */
export const EXEMPT_API_PREFIXES = [
  "/api/auth",
  "/api/cron",
  "/api/email/send",
  "/api/ai/chat",
  "/api/superadmin",
];

/** Area landing pages: open when the user holds at least one module beneath the area. */
const HUB_PAGES: Array<{ path: string; area: string }> = [
  { path: "/dashboard/sales", area: "/dashboard/sales/" },
  { path: "/dashboard/purchases", area: "/dashboard/purchases/" },
  { path: "/dashboard/accounting", area: "/dashboard/accounting/" },
  { path: "/dashboard/inventory", area: "/dashboard/inventory/" },
  { path: "/dashboard/gst", area: "/dashboard/gst/" },
  { path: "/dashboard/hr", area: "/dashboard/hr/" },
  { path: "/dashboard/reports", area: "/dashboard/reports/" },
  { path: "/dashboard/settings/taxes", area: "/dashboard/settings/taxes/" },
];

/** Mirror of the `rewrites()` aliases in next.config.ts — the proxy sees the pre-rewrite path. */
const PATH_ALIASES: Array<[from: string, to: string]> = [
  ["/integrations", "/dashboard/integrations"],
  ["/settings", "/dashboard/settings"],
  ["/banking", "/dashboard/banking"],
  ["/time-tracking", "/dashboard/time-tracking"],
  ["/tasks", "/dashboard/tasks"],
  ["/api/currencies", "/api/settings/currencies"],
  ["/api/journals", "/api/accounting/journals"],
  ["/api/recurring-invoices", "/api/sales/recurring-invoices"],
  ["/api/credit-notes", "/api/sales/credit-notes"],
];

export function normalizeAppPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  for (const [from, to] of PATH_ALIASES) {
    if (p === from || p.startsWith(`${from}/`)) return to + p.slice(from.length);
  }
  return p;
}

function prefixMatches(path: string, prefix: string): boolean {
  if (prefix.startsWith("=")) return path === prefix.slice(1);
  return path === prefix || path.startsWith(`${prefix}/`);
}

function longestOwner(path: string, pick: (m: ModuleDefinition) => string[]): ModuleDefinition | null {
  let best: ModuleDefinition | null = null;
  let bestLen = -1;
  for (const m of MODULES) {
    for (const prefix of pick(m)) {
      if (prefixMatches(path, prefix)) {
        const len = prefix.replace(/^=/, "").length;
        if (len > bestLen) {
          best = m;
          bestLen = len;
        }
      }
    }
  }
  return best;
}

/** Module that owns a page or API path, or null when the path is not module-controlled. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const p = normalizeAppPath(pathname);
  if (p.startsWith("/api/")) {
    if (EXEMPT_API_PREFIXES.some((x) => prefixMatches(p, x))) return null;
    return longestOwner(p, (m) => m.apis)?.key ?? null;
  }
  if (EXEMPT_PAGES.some((x) => prefixMatches(p, x))) return null;
  return longestOwner(p, (m) => m.pages)?.key ?? null;
}

function isSharedRead(apiPath: string): boolean {
  return MODULES.some((m) => (m.sharedReads ?? []).some((x) => prefixMatches(apiPath, x)));
}

/**
 * Whether a request is allowed given the user's effective module keys.
 * `method` only matters for APIs (shared reference-data GETs).
 */
export function isPathAllowedForModules(pathname: string, allowed: ReadonlySet<string>, method = "GET"): boolean {
  const p = normalizeAppPath(pathname);
  if (!p.startsWith("/api/")) {
    const hub = HUB_PAGES.find((h) => h.path === p);
    if (hub) {
      return MODULES.some((m) => allowed.has(m.key) && m.pages.some((pg) => pg.replace(/^=/, "").startsWith(hub.area)));
    }
  }
  const owner = moduleForPath(p);
  if (!owner) return true;
  if (allowed.has(owner)) return true;
  if (p.startsWith("/api/") && (method === "GET" || method === "HEAD") && isSharedRead(p)) return true;
  return false;
}
