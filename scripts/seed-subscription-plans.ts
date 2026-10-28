/**
 * Creates or updates the default subscription plan catalogue (idempotent, keyed by `code`).
 * Prices are INR per interval, exclusive of GST. Review them before production use.
 *
 *   npm run seed:plans
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { ModuleKey } from "../src/lib/superadmin/modules";
import { ALL_MODULE_KEYS } from "../src/lib/superadmin/modules";

const prisma = new PrismaClient();

const FREE: ModuleKey[] = [
  "dashboard",
  "company",
  "customers",
  "suppliers",
  "sales_invoices",
  "quotations",
  "expenses",
  "products_services",
  "chart_of_accounts",
  "gst_config",
  "gst_tax_rates",
  "settings",
];

const STARTER: ModuleKey[] = [
  ...FREE,
  "sales",
  "purchases",
  "purchase_invoices",
  "inventory",
  "stock_reports",
  "banking",
  "general_ledger",
  "manual_journal",
  "trial_balance",
  "profit_loss",
  "balance_sheet",
  "gstr3b",
  "credit_debit_notes",
];

const PROFESSIONAL: ModuleKey[] = [
  ...STARTER,
  "bank_reconciliation",
  "gst_reconciliation",
  "eway_bill",
  "fixed_assets",
  "employees",
  "payroll",
  "tasks",
  "time_tracking",
  "ocr",
];

const PLANS = [
  {
    code: "free",
    name: "Free",
    description: "GST invoicing and basic bookkeeping for a single user.",
    monthlyPrice: 0,
    annualPrice: 0,
    isFree: true,
    trialDays: 0,
    maxUsers: 1,
    maxCompanies: 1,
    modules: FREE,
    features: ["GST-compliant invoices", "Customer & supplier masters", "Email support"],
    sortOrder: 10,
  },
  {
    code: "trial",
    name: "Trial",
    description: "Every module for 14 days.",
    monthlyPrice: 0,
    annualPrice: 0,
    isFree: true,
    trialDays: 14,
    maxUsers: 3,
    maxCompanies: 1,
    modules: ["*"],
    features: ["Full product evaluation", "No payment details required"],
    sortOrder: 20,
  },
  {
    code: "starter",
    name: "Starter",
    description: "Full books, banking, inventory and GSTR-3B for small businesses.",
    monthlyPrice: 499,
    annualPrice: 4990,
    isFree: false,
    trialDays: 0,
    maxUsers: 3,
    maxCompanies: 1,
    modules: STARTER,
    features: ["Banking & inventory", "Financial reports", "GSTR-3B"],
    sortOrder: 30,
  },
  {
    code: "professional",
    name: "Professional",
    description: "GST reconciliation, e-way bills, payroll and fixed assets.",
    monthlyPrice: 1499,
    annualPrice: 14990,
    isFree: false,
    trialDays: 0,
    maxUsers: 10,
    maxCompanies: 1,
    modules: PROFESSIONAL,
    features: ["GSTR-2A reconciliation & ITC", "E-way bills", "Payroll", "OCR"],
    sortOrder: 40,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Every module, unlimited users, and accounting integrations.",
    monthlyPrice: 3999,
    annualPrice: 39990,
    isFree: false,
    trialDays: 0,
    maxUsers: null,
    maxCompanies: 1,
    modules: ["*"],
    features: ["Tally / Zoho / QuickBooks", "Priority support"],
    sortOrder: 50,
  },
];

async function main() {
  for (const p of PLANS) {
    const bad = p.modules.filter((m) => m !== "*" && !(ALL_MODULE_KEYS as readonly string[]).includes(m));
    if (bad.length) throw new Error(`Plan ${p.code} references unknown modules: ${bad.join(", ")}`);
    const data = { ...p, modules: [...p.modules] };
    await prisma.subscriptionPlan.upsert({ where: { code: p.code }, create: data, update: data });
    console.log(`✓ ${p.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
