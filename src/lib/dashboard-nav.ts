export type SalesSlug =
  | "customers"
  | "quotes"
  | "invoices"
  | "payments-received"
  | "credit-notes"
  | "recurring-invoices"
  | "delivery-challans"
  | "payment-links";

export type PurchasesSlug =
  | "vendors"
  | "expenses"
  | "recurring-expenses"
  | "purchase-orders"
  | "bills"
  | "recurring-bills"
  | "payments-made"
  | "vendor-credits"
  | "purchase-returns";

export const SALES_MODULES: {
  slug: SalesSlug;
  label: string;
  description: string;
}[] = [
  {
    slug: "customers",
    label: "Customers",
    description: "Store contact details, payment terms, and billing addresses for people you invoice.",
  },
  {
    slug: "invoices",
    label: "Invoices",
    description: "Bill customers for goods and services; track status and amounts due.",
  },
  {
    slug: "payments-received",
    label: "Payments Received",
    description: "Record inbound payments and allocate them to open invoices.",
  },
  {
    slug: "credit-notes",
    label: "Credit Notes",
    description: "Issue refunds or reductions applied against customer invoices.",
  },
  {
    slug: "quotes",
    label: "Quotes",
    description: "Create and send quotations with line items, tax, and statuses; convert to invoices when accepted.",
  },
  {
    slug: "recurring-invoices",
    label: "Recurring Invoices",
    description: "Automate invoices that repeat on a schedule such as subscriptions.",
  },
  {
    slug: "delivery-challans",
    label: "Delivery Challans",
    description: "Ship goods with a delivery note before or after invoicing.",
  },
  {
    slug: "payment-links",
    label: "Payment Links",
    description: "Collect customer payments via shareable payment links.",
  },
];

export const PURCHASES_MODULES: {
  slug: PurchasesSlug;
  label: string;
  description: string;
}[] = [
  {
    slug: "vendors",
    label: "Vendors",
    description: "Maintain supplier records used on bills, POs, and payments.",
  },
  {
    slug: "expenses",
    label: "Expenses",
    description: "Record everyday spend such as travel, meals, and miscellaneous costs.",
  },
  {
    slug: "recurring-expenses",
    label: "Recurring Expenses",
    description: "Schedule expenses that repeat automatically.",
  },
  {
    slug: "purchase-orders",
    label: "Purchase Orders",
    description: "Send formal orders to vendors before goods or services are received.",
  },
  {
    slug: "bills",
    label: "Bills",
    description: "Enter vendor invoices your business needs to pay.",
  },
  {
    slug: "recurring-bills",
    label: "Recurring Bills",
    description: "Automate bills that arrive on a regular cadence, such as utilities.",
  },
  {
    slug: "payments-made",
    label: "Payments Made",
    description: "Track outbound payments applied to bills and expenses.",
  },
  {
    slug: "vendor-credits",
    label: "Vendor Credits",
    description: "Track amounts vendors owe back to you, such as returns or overpayments.",
  },
  {
    slug: "purchase-returns",
    label: "Purchase Returns",
    description: "Return goods to suppliers and generate E-Way Bills for reverse logistics.",
  },
];

/** Legacy href kept for redirects to `/dashboard/inventory/items`. */
export const ITEMS_MODULE = {
  href: "/dashboard/inventory/items",
  label: "Items",
  description:
    "Central catalogue for goods and services — purchase and sales rates, units, and descriptions.",
} as const;

export type InventorySlug =
  | "items"
  | "categories"
  | "units"
  | "warehouses"
  | "stock-adjustments"
  | "valuation";

export const INVENTORY_MODULES: {
  slug: InventorySlug;
  label: string;
  description: string;
}[] = [
  {
    slug: "items",
    label: "Items",
    description: "SKU, pricing, stock levels, and status.",
  },
  {
    slug: "categories",
    label: "Categories",
    description: "Organize items for reporting and filters.",
  },
  {
    slug: "units",
    label: "Units",
    description: "Numbers, kilograms, liters, and custom units.",
  },
  {
    slug: "warehouses",
    label: "Warehouses",
    description: "Multiple locations with stock per warehouse.",
  },
  {
    slug: "stock-adjustments",
    label: "Stock Adjustments",
    description: "Increase or decrease quantity with a mandatory reason.",
  },
  {
    slug: "valuation",
    label: "Inventory Valuation",
    description: "Stock on hand valued by FIFO or weighted average.",
  },
];

export function hrefForInventorySlug(slug: InventorySlug): string {
  return `/dashboard/inventory/${slug}`;
}

export type AccountingSlug =
  | "chart-of-accounts"
  | "journal-entries"
  | "general-ledger"
  | "profit-loss"
  | "balance-sheet"
  | "trial-balance"
  | "recurring-journals"
  | "fixed-assets"
  | "depreciation";

export const ACCOUNTING_MODULES: {
  slug: AccountingSlug;
  label: string;
  description: string;
}[] = [
  {
    slug: "chart-of-accounts",
    label: "Chart of Accounts",
    description: "Hierarchical accounts with types, codes, and opening balances.",
  },
  {
    slug: "journal-entries",
    label: "Journal Entries",
    description: "Create, edit, and post double-entry journals; debits must equal credits before posting.",
  },
  {
    slug: "general-ledger",
    label: "General Ledger",
    description: "Posted activity and running balance by account.",
  },
  {
    slug: "fixed-assets",
    label: "Fixed Assets",
    description: "Register capital assets, useful life, and GL links for cost and depreciation.",
  },
  {
    slug: "depreciation",
    label: "Depreciation",
    description: "Run period depreciation, preview schedules, and review posted accruals.",
  },
  {
    slug: "recurring-journals",
    label: "Recurring Journals",
    description: "Automate journal templates that post on a schedule.",
  },
  {
    slug: "profit-loss",
    label: "Profit & Loss",
    description: "Income and expenses from posted journals for a selected period.",
  },
  {
    slug: "balance-sheet",
    label: "Balance Sheet",
    description: "Assets, liabilities, and equity derived from posted ledger activity.",
  },
  {
    slug: "trial-balance",
    label: "Trial Balance",
    description: "Account debits and credits for a period — totals must agree.",
  },
];

export function hrefForAccountingSlug(slug: AccountingSlug): string {
  if (slug === "journal-entries") return "/dashboard/accounting/manual-journal";
  if (slug === "recurring-journals") return "/dashboard/accounting/recurring-journals";
  if (slug === "fixed-assets") return "/dashboard/accounting/fixed-assets";
  if (slug === "depreciation") return "/dashboard/accounting/depreciation";
  if (slug === "profit-loss") return "/dashboard/reports/pnl";
  if (slug === "balance-sheet") return "/dashboard/reports/balance-sheet";
  if (slug === "trial-balance") return "/dashboard/reports/trial-balance";
  return `/dashboard/accounting/${slug}`;
}

export const MODULES_AFTER_PURCHASES: {
  href: string;
  label: string;
  description: string;
}[] = [
  {
    href: "/dashboard/time-tracking",
    label: "Time Tracking",
    description: "Log billable time on projects and turn hours into invoice lines.",
  },
  {
    href: "/dashboard/tasks",
    label: "Tasks",
    description: "Organize work with owners, priorities, and due dates.",
  },
  {
    href: "/dashboard/banking",
    label: "Banking",
    description: "Import or connect bank activity, categorize transactions, and reconcile accounts.",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    description: "Profit and loss, balance sheet, cash flow, aging, and operational summaries.",
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    description: "Upload receipts and contracts and attach them to transactions.",
  },
];
