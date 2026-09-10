import { createHash } from "crypto";

export type TallyParsedGroup = {
  name: string;
  parent: string | null;
  guid: string | null;
  reservedName: string | null;
};

export type TallyParsedLedger = {
  name: string;
  parent: string | null;
  guid: string | null;
  alias: string | null;
  openingBalance: number;
  isDebit: boolean;
  gstin: string | null;
  pan: string | null;
  address: string | null;
};

export type TallyParsedVoucherLine = {
  ledgerName: string;
  amount: number;
  isDebit: boolean;
};

export type TallyParsedVoucher = {
  voucherType: string;
  voucherNumber: string | null;
  date: string;
  guid: string | null;
  narration: string | null;
  lines: TallyParsedVoucherLine[];
};

export type TallyParsedStockItem = {
  name: string;
  parent: string | null;
  guid: string | null;
  unit: string | null;
  openingQty: number;
  openingValue: number;
  hsnCode: string | null;
  gstRate: number | null;
};

export type TallyParsedCompany = {
  name: string | null;
  gstin: string | null;
  financialYearFrom: string | null;
};

export type TallyParsedExport = {
  company: TallyParsedCompany;
  groups: TallyParsedGroup[];
  ledgers: TallyParsedLedger[];
  vouchers: TallyParsedVoucher[];
  stockItems: TallyParsedStockItem[];
  trialBalanceFromTally: Array<{ ledgerName: string; debit: number; credit: number }>;
};

export type TallyMigrationPhases = {
  coa: boolean;
  vouchers: boolean;
  inventory: boolean;
  reconcile: boolean;
};

export type TallyMigrationStats = {
  groupsImported: number;
  groupsSkipped: number;
  ledgersImported: number;
  ledgersUpdated: number;
  ledgersSkipped: number;
  vouchersImported: number;
  vouchersSkipped: number;
  vouchersFailed: number;
  stockItemsImported: number;
  openingBalanceDelta: number;
};

export type ReconcileRow = {
  ledgerName: string;
  tallyDebit: number;
  tallyCredit: number;
  erpDebit: number;
  erpCredit: number;
  debitDiff: number;
  creditDiff: number;
};

export function hashTallySource(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export const DEFAULT_MIGRATION_PHASES: TallyMigrationPhases = {
  coa: true,
  vouchers: true,
  inventory: true,
  reconcile: true,
};
