import { AccountType, JournalPostingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseReportDate(s: string | null, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

async function postedEntriesInRange(userId: string, from: Date, to: Date) {
  return prisma.journalEntry.findMany({
    where: {
      userId,
      postingStatus: JournalPostingStatus.POSTED,
      entryDate: { gte: startOfDay(from), lte: endOfDay(to) },
    },
    include: {
      lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
    },
  });
}

async function postedEntriesUpTo(userId: string, asOf: Date) {
  return prisma.journalEntry.findMany({
    where: {
      userId,
      postingStatus: JournalPostingStatus.POSTED,
      entryDate: { lte: endOfDay(asOf) },
    },
    include: {
      lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
    },
  });
}

/** Trial balance: posted lines in date range by account. */
export async function trialBalanceReport(userId: string, from: Date, to: Date) {
  const entries = await postedEntriesInRange(userId, from, to);
  const map = new Map<string, { code: string; name: string; debit: number; credit: number }>();
  for (const je of entries) {
    for (const line of je.lines) {
      const cur = map.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        debit: 0,
        credit: 0,
      };
      cur.debit += Number(line.debit);
      cur.credit += Number(line.credit);
      map.set(line.accountId, cur);
    }
  }
  const rows = [...map.entries()]
    .map(([accountId, v]) => ({
      accountId,
      code: v.code,
      name: v.name,
      debit: round2(v.debit),
      credit: round2(v.credit),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDebit, totalCredit };
}

/** P&L from posted journals (income credit-normal, expense debit-normal). */
export async function profitAndLossReport(userId: string, from: Date, to: Date) {
  const entries = await postedEntriesInRange(userId, from, to);
  const incomeBy = new Map<string, { code: string; name: string; amount: number }>();
  const expenseBy = new Map<string, { code: string; name: string; amount: number }>();
  let income = 0;
  let expense = 0;
  for (const je of entries) {
    for (const line of je.lines) {
      const d = Number(line.debit);
      const c = Number(line.credit);
      if (line.account.type === AccountType.INCOME) {
        const net = round2(c - d);
        income += net;
        const cur = incomeBy.get(line.accountId) ?? {
          code: line.account.code,
          name: line.account.name,
          amount: 0,
        };
        cur.amount = round2(cur.amount + net);
        incomeBy.set(line.accountId, cur);
      } else if (line.account.type === AccountType.EXPENSE) {
        const net = round2(d - c);
        expense += net;
        const cur = expenseBy.get(line.accountId) ?? {
          code: line.account.code,
          name: line.account.name,
          amount: 0,
        };
        cur.amount = round2(cur.amount + net);
        expenseBy.set(line.accountId, cur);
      }
    }
  }
  income = round2(income);
  expense = round2(expense);
  return {
    incomeTotal: income,
    expenseTotal: expense,
    netProfit: round2(income - expense),
    incomeLines: [...incomeBy.values()].sort((a, b) => a.code.localeCompare(b.code)),
    expenseLines: [...expenseBy.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
}

/** Cumulative P&L (income − expense) through asOf from posted journals. */
export async function cumulativePnLThrough(userId: string, asOf: Date) {
  const entries = await postedEntriesUpTo(userId, asOf);
  let income = 0;
  let expense = 0;
  for (const je of entries) {
    for (const line of je.lines) {
      const d = Number(line.debit);
      const c = Number(line.credit);
      if (line.account.type === AccountType.INCOME) income += c - d;
      else if (line.account.type === AccountType.EXPENSE) expense += d - c;
    }
  }
  return round2(round2(income) - round2(expense));
}

/** Balance sheet: ASSET / LIABILITY / EQUITY balances through asOf, plus cumulative P&L in equity. */
export async function balanceSheetReport(userId: string, asOf: Date) {
  const entries = await postedEntriesUpTo(userId, asOf);
  const retained = await cumulativePnLThrough(userId, asOf);
  type Row = { code: string; name: string; balance: number };
  const assets: Row[] = [];
  const liabilities: Row[] = [];
  const equity: Row[] = [];
  const sums = new Map<string, { code: string; name: string; type: AccountType; bal: number }>();

  for (const je of entries) {
    for (const line of je.lines) {
      const d = Number(line.debit);
      const c = Number(line.credit);
      const t = line.account.type;
      if (t !== AccountType.ASSET && t !== AccountType.LIABILITY && t !== AccountType.EQUITY) continue;
      const cur = sums.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        type: t,
        bal: 0,
      };
      if (t === AccountType.ASSET) cur.bal += d - c;
      else cur.bal += c - d;
      sums.set(line.accountId, cur);
    }
  }

  for (const v of sums.values()) {
    const row = { code: v.code, name: v.name, balance: round2(v.bal) };
    if (v.type === AccountType.ASSET) assets.push(row);
    else if (v.type === AccountType.LIABILITY) liabilities.push(row);
    else equity.push(row);
  }
  assets.sort((a, b) => a.code.localeCompare(b.code));
  liabilities.sort((a, b) => a.code.localeCompare(b.code));
  equity.sort((a, b) => a.code.localeCompare(b.code));

  const assetTotal = round2(assets.reduce((s, r) => s + r.balance, 0));
  const liabilityTotal = round2(liabilities.reduce((s, r) => s + r.balance, 0));
  const equityAccountsTotal = round2(equity.reduce((s, r) => s + r.balance, 0));
  const equityTotal = round2(equityAccountsTotal + retained);
  const liabilitiesAndEquity = round2(liabilityTotal + equityTotal);

  return {
    asOf: asOf.toISOString().slice(0, 10),
    assets,
    liabilities,
    equity,
    retainedEarningsComputed: retained,
    assetTotal,
    liabilityTotal,
    equityAccountsTotal,
    equityTotal,
    liabilitiesAndEquity,
    equationOk: Math.abs(assetTotal - liabilitiesAndEquity) < 0.02,
  };
}
