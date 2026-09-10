import { AccountType, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const DEFAULT_ACCOUNTS: { code: string; name: string; type: AccountType }[] = [
  { code: "1010", name: "Bank / Cash", type: AccountType.ASSET },
  { code: "1200", name: "Accounts Receivable", type: AccountType.ASSET },
  { code: "1410", name: "GST / VAT Input", type: AccountType.ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
  { code: "4000", name: "Sales Revenue", type: AccountType.INCOME },
  { code: "5000", name: "General Purchases", type: AccountType.EXPENSE },
  { code: "2210", name: "GST / VAT Output", type: AccountType.LIABILITY },
];

const LEGACY_EXTRA_CODES: { code: string; name: string; type: AccountType }[] = [
  { code: "1410", name: "GST / VAT Input", type: AccountType.ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
  { code: "5000", name: "General Purchases", type: AccountType.EXPENSE },
];

/**
 * Full reference chart (names/types from product UI). Unique codes; `isSystem: false` so rows show the checkbox
 * column like sample data — core integration accounts above stay `isSystem: true`.
 */
const EXTENDED_CHART_TEMPLATE: { code: string; name: string; type: AccountType }[] = [
  // Assets (reference lists)
  { code: "1020", name: "Employee Advance", type: AccountType.ASSET },
  { code: "1022", name: "Petty Cash", type: AccountType.ASSET },
  { code: "1024", name: "Undeposited Funds", type: AccountType.ASSET },
  { code: "1026", name: "Prepaid Expenses", type: AccountType.ASSET },
  { code: "1028", name: "TDS Receivable", type: AccountType.ASSET },
  { code: "1030", name: "Advance Tax", type: AccountType.ASSET },
  { code: "1032", name: "Furniture and Equipment", type: AccountType.ASSET },
  { code: "1034", name: "Inventory Asset", type: AccountType.ASSET },
  // Liabilities
  { code: "2100", name: "Construction Loans", type: AccountType.LIABILITY },
  { code: "2105", name: "Dimension Adjustments", type: AccountType.LIABILITY },
  { code: "2110", name: "Tax Payable", type: AccountType.LIABILITY },
  { code: "2115", name: "Employee Reimbursements", type: AccountType.LIABILITY },
  { code: "2120", name: "Opening Balance Adjustments", type: AccountType.LIABILITY },
  // Equity
  { code: "3010", name: "Retained Earnings", type: AccountType.EQUITY },
  { code: "3015", name: "Drawings", type: AccountType.EQUITY },
  { code: "3020", name: "Investments", type: AccountType.EQUITY },
  { code: "3025", name: "Distributions", type: AccountType.EQUITY },
  { code: "3030", name: "Dividends Paid", type: AccountType.EQUITY },
  { code: "3035", name: "Owner's Equity", type: AccountType.EQUITY },
  { code: "3040", name: "Opening Balance Offset", type: AccountType.EQUITY },
  { code: "3045", name: "Capital Stock", type: AccountType.EQUITY },
  // Income
  { code: "1500", name: "Fixed Assets (at cost)", type: AccountType.ASSET },
  { code: "1509", name: "Accumulated Depreciation", type: AccountType.ASSET },
  { code: "4135", name: "Gain on Sale of Assets", type: AccountType.INCOME },
  { code: "5185", name: "Loss on Disposal of Assets", type: AccountType.EXPENSE },
  { code: "4105", name: "Sales", type: AccountType.INCOME },
  { code: "4110", name: "General Income", type: AccountType.INCOME },
  { code: "4115", name: "Interest Income", type: AccountType.INCOME },
  { code: "4120", name: "Other Charges", type: AccountType.INCOME },
  { code: "4125", name: "Late Fee Income", type: AccountType.INCOME },
  { code: "4130", name: "Discount", type: AccountType.INCOME },
  // Expenses
  { code: "5020", name: "Purchase Discounts", type: AccountType.EXPENSE },
  { code: "5025", name: "Depreciation And Amortisation", type: AccountType.EXPENSE },
  { code: "5030", name: "Transportation Expense", type: AccountType.EXPENSE },
  { code: "5035", name: "Merchandise", type: AccountType.EXPENSE },
  { code: "5040", name: "Uncategorized", type: AccountType.EXPENSE },
  { code: "5045", name: "Raw Materials And Consumables", type: AccountType.EXPENSE },
  { code: "5050", name: "Contract Assets", type: AccountType.EXPENSE },
  { code: "5055", name: "Rent Expense", type: AccountType.EXPENSE },
  { code: "5060", name: "Office Supplies", type: AccountType.EXPENSE },
  { code: "5065", name: "Advertising And Marketing", type: AccountType.EXPENSE },
  { code: "5070", name: "Bank Fees and Charges", type: AccountType.EXPENSE },
  { code: "5075", name: "Credit Card Charges", type: AccountType.EXPENSE },
  { code: "5080", name: "Travel Expense", type: AccountType.EXPENSE },
  { code: "5085", name: "Telephone Expense", type: AccountType.EXPENSE },
  { code: "5090", name: "Automobile Expense", type: AccountType.EXPENSE },
  { code: "5095", name: "IT and Internet Expenses", type: AccountType.EXPENSE },
  { code: "5100", name: "Janitorial Expense", type: AccountType.EXPENSE },
  { code: "5105", name: "Postage", type: AccountType.EXPENSE },
  { code: "5110", name: "Bad Debt", type: AccountType.EXPENSE },
  { code: "5115", name: "Printing and Stationery", type: AccountType.EXPENSE },
  { code: "5120", name: "Salaries and Employee Wages", type: AccountType.EXPENSE },
  { code: "5125", name: "Meals and Entertainment", type: AccountType.EXPENSE },
  { code: "5130", name: "Depreciation Expense", type: AccountType.EXPENSE },
  { code: "5135", name: "Consultant Expense", type: AccountType.EXPENSE },
  { code: "5140", name: "Repairs and Maintenance", type: AccountType.EXPENSE },
  { code: "5145", name: "Other Expenses", type: AccountType.EXPENSE },
  { code: "5150", name: "Lodging", type: AccountType.EXPENSE },
  { code: "5155", name: "Cost of Goods Sold", type: AccountType.EXPENSE },
  { code: "5160", name: "Labor", type: AccountType.EXPENSE },
  { code: "5165", name: "Materials", type: AccountType.EXPENSE },
  { code: "5170", name: "Subcontractor", type: AccountType.EXPENSE },
  { code: "5175", name: "Job Costing", type: AccountType.EXPENSE },
  { code: "5180", name: "Exchange Gain or Loss", type: AccountType.EXPENSE },
];

async function ensureExtendedChartTemplates(db: PrismaClient | Prisma.TransactionClient, userId: string) {
  for (const a of EXTENDED_CHART_TEMPLATE) {
    await db.account.upsert({
      where: { userId_code: { userId, code: a.code } },
      create: {
        userId,
        code: a.code,
        name: a.name,
        type: a.type,
        isSystem: false,
      },
      update: {},
    });
  }
}

export async function ensureDefaultAccounts(db: PrismaClient | Prisma.TransactionClient, userId: string) {
  const n = await db.account.count({ where: { userId } });
  if (n > 0) {
    await ensureLegacyPurchaseAccounts(db, userId);
    await ensureExtendedChartTemplates(db, userId);
    return;
  }

  await db.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      userId,
      code: a.code,
      name: a.name,
      type: a.type,
      isSystem: true,
    })),
  });
  await ensureExtendedChartTemplates(db, userId);
}

/** Adds AP / GST Input / General Purchases for orgs created before purchases module. */
async function ensureLegacyPurchaseAccounts(db: PrismaClient | Prisma.TransactionClient, userId: string) {
  for (const a of LEGACY_EXTRA_CODES) {
    await db.account.upsert({
      where: { userId_code: { userId, code: a.code } },
      create: {
        userId,
        code: a.code,
        name: a.name,
        type: a.type,
        isSystem: true,
      },
      update: {},
    });
  }
}

export type SystemAccountIds = {
  bankId: string;
  arId: string;
  salesId: string;
  taxId: string;
};

export async function getSystemAccountIds(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<SystemAccountIds> {
  await ensureDefaultAccounts(db, userId);
  const rows = await db.account.findMany({
    where: { userId, code: { in: ["1010", "1200", "4000", "2210"] } },
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.id])) as Record<string, string>;
  return {
    bankId: byCode["1010"]!,
    arId: byCode["1200"]!,
    salesId: byCode["4000"]!,
    taxId: byCode["2210"]!,
  };
}

export type PurchasesAccountIds = SystemAccountIds & {
  apId: string;
  gstInputId: string;
  generalPurchasesId: string;
};

export async function getPurchasesAccountIds(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<PurchasesAccountIds> {
  const base = await getSystemAccountIds(db, userId);
  const rows = await db.account.findMany({
    where: { userId, code: { in: ["2000", "1410", "5000"] } },
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.id])) as Record<string, string>;
  return {
    ...base,
    apId: byCode["2000"]!,
    gstInputId: byCode["1410"]!,
    generalPurchasesId: byCode["5000"]!,
  };
}
