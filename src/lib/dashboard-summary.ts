import { AccountType, InvoiceStatus, JournalPostingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";

export type DashboardSummary = {
  periodLabel: string;
  kpis: {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    totalCollections: number;
    pendingReceivables: number;
    payables: number;
    modules: {
      purchases: boolean;
      payables: boolean;
      expensesFromJournal: boolean;
    };
  };
  trends: {
    salesPct: number | null;
    purchasesPct: number | null;
    expensesPct: number | null;
    collectionsPct: number | null;
    receivablesPct: number | null;
    payablesPct: number | null;
  };
  monthly: Array<{ month: string; label: string; sales: number; expenses: number }>;
  cashFlowMonthly: Array<{ month: string; label: string; inflow: number; outflow: number }>;
  receivablesSplit: { pending: number; collected: number };
  payablesSplit: { pending: number; paid: number };
  recentActivities: Array<{
    id: string;
    date: string;
    type: string;
    reference: string;
    amount: number;
    status: string;
  }>;
};

const SALES_STATUSES: InvoiceStatus[] = ["SENT", "PARTIALLY_PAID", "PAID"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function last12MonthKeys(end: Date): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(d);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function balanceDue(inv: {
  total: Prisma.Decimal;
  payableTotal: Prisma.Decimal;
  allocations: { amount: Prisma.Decimal }[];
}): number {
  const t = invoiceOpenAmount(inv);
  const alloc = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
  return Math.max(0, round2(t - alloc));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function inClosedRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = new Date();
  const windowStart = startOfMonth(addMonths(now, -11));
  const queryFrom = startOfMonth(addMonths(now, -13));

  const monthKeys = last12MonthKeys(now);
  const monthlySales = Object.fromEntries(monthKeys.map((k) => [k, 0])) as Record<string, number>;
  const monthlyExpenses = Object.fromEntries(monthKeys.map((k) => [k, 0])) as Record<string, number>;
  const monthlyInflow = Object.fromEntries(monthKeys.map((k) => [k, 0])) as Record<string, number>;
  const monthlyOutflow = Object.fromEntries(monthKeys.map((k) => [k, 0])) as Record<string, number>;

  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const d60 = new Date(now);
  d60.setDate(d60.getDate() - 60);

  const [invoices, payments, expenseLines] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId,
        issueDate: { gte: queryFrom },
        status: { not: InvoiceStatus.VOID },
      },
      include: { allocations: true },
    }),
    prisma.payment.findMany({
      where: { userId, paymentDate: { gte: queryFrom } },
    }),
    prisma.journalLine.findMany({
      where: {
        debit: { gt: 0 },
        account: { userId, type: AccountType.EXPENSE },
        journalEntry: {
          userId,
          postingStatus: JournalPostingStatus.POSTED,
          entryDate: { gte: queryFrom },
        },
      },
      select: {
        debit: true,
        journalEntry: { select: { entryDate: true } },
      },
    }),
  ]);

  let salesWindow = 0;
  let salesLast30 = 0;
  let salesPrev30Window = 0;
  let collectionsWindow = 0;
  let collectionsLast30 = 0;
  let collectionsPrev30Window = 0;
  let expensesWindow = 0;
  let expensesLast30 = 0;
  let expensesPrev30 = 0;
  let outstanding = 0;

  for (const inv of invoices) {
    const issue = new Date(inv.issueDate);
    const t = Number(inv.total);

    if (SALES_STATUSES.includes(inv.status)) {
      if (inClosedRange(issue, windowStart, now)) salesWindow += t;
      const k = monthKey(issue);
      if (k in monthlySales) monthlySales[k] += t;

      if (issue >= d30 && issue <= now) salesLast30 += t;
      else if (issue >= d60 && issue < d30) salesPrev30Window += t;
    }

    if (SALES_STATUSES.includes(inv.status)) {
      outstanding += balanceDue(inv);
    }
  }

  for (const p of payments) {
    const pd = new Date(p.paymentDate);
    const amt = Number(p.amount);
    if (inClosedRange(pd, windowStart, now)) collectionsWindow += amt;
    const k = monthKey(pd);
    if (k in monthlyInflow) monthlyInflow[k] += amt;

    if (pd >= d30 && pd <= now) collectionsLast30 += amt;
    else if (pd >= d60 && pd < d30) collectionsPrev30Window += amt;
  }

  for (const line of expenseLines) {
    const ed = new Date(line.journalEntry.entryDate);
    const amt = Number(line.debit);
    if (inClosedRange(ed, windowStart, now)) expensesWindow += amt;
    const k = monthKey(ed);
    if (k in monthlyExpenses) monthlyExpenses[k] += amt;
    if (k in monthlyOutflow) monthlyOutflow[k] += amt;

    if (ed >= d30 && ed <= now) expensesLast30 += amt;
    else if (ed >= d60 && ed < d30) expensesPrev30 += amt;
  }

  let collectedDisplay = 0;
  for (const inv of invoices) {
    if (!SALES_STATUSES.includes(inv.status)) continue;
    collectedDisplay += inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
  }

  const monthly = monthKeys.map((m) => ({
    month: m,
    label: monthLabel(m),
    sales: round2(monthlySales[m] ?? 0),
    expenses: round2(monthlyExpenses[m] ?? 0),
  }));

  const cashFlowMonthly = monthKeys.map((m) => ({
    month: m,
    label: monthLabel(m),
    inflow: round2(monthlyInflow[m] ?? 0),
    outflow: round2(monthlyOutflow[m] ?? 0),
  }));

  const [recentInvoices, recentPayments, recentQuotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { issueDate: "desc" },
      take: 8,
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        total: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { paymentDate: "desc" },
      take: 8,
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        amount: true,
        mode: true,
      },
    }),
    prisma.quote.findMany({
      where: { userId },
      orderBy: { quoteDate: "desc" },
      take: 6,
      select: {
        id: true,
        quoteNumber: true,
        quoteDate: true,
        total: true,
        status: true,
      },
    }),
  ]);

  type Act = {
    id: string;
    date: string;
    type: string;
    reference: string;
    amount: number;
    status: string;
    sort: number;
  };

  const activities: Act[] = [];

  for (const r of recentInvoices) {
    activities.push({
      id: `inv-${r.id}`,
      date: r.issueDate.toISOString(),
      type: "Sales Invoice",
      reference: r.invoiceNumber,
      amount: Number(r.total),
      status: r.status,
      sort: r.issueDate.getTime(),
    });
  }
  for (const r of recentPayments) {
    activities.push({
      id: `pay-${r.id}`,
      date: r.paymentDate.toISOString(),
      type: "Payment Received",
      reference: r.paymentNumber,
      amount: Number(r.amount),
      status: String(r.mode),
      sort: r.paymentDate.getTime(),
    });
  }
  for (const r of recentQuotes) {
    activities.push({
      id: `qt-${r.id}`,
      date: r.quoteDate.toISOString(),
      type: "Quote",
      reference: r.quoteNumber,
      amount: Number(r.total),
      status: r.status,
      sort: r.quoteDate.getTime(),
    });
  }

  activities.sort((a, b) => b.sort - a.sort);
  const recentActivities = activities.slice(0, 14).map(({ sort: _, ...rest }) => ({
    ...rest,
    amount: round2(rest.amount),
  }));

  return {
    periodLabel: "Last 12 months",
    kpis: {
      totalSales: round2(salesWindow),
      totalPurchases: 0,
      totalExpenses: round2(expensesWindow),
      totalCollections: round2(collectionsWindow),
      pendingReceivables: round2(outstanding),
      payables: 0,
      modules: {
        purchases: false,
        payables: false,
        expensesFromJournal: true,
      },
    },
    trends: {
      salesPct: pctChange(salesLast30, salesPrev30Window),
      purchasesPct: null,
      expensesPct: pctChange(expensesLast30, expensesPrev30),
      collectionsPct: pctChange(collectionsLast30, collectionsPrev30Window),
      receivablesPct: null,
      payablesPct: null,
    },
    monthly,
    cashFlowMonthly,
    receivablesSplit: {
      pending: round2(outstanding),
      collected: round2(collectedDisplay),
    },
    payablesSplit: { pending: 0, paid: 0 },
    recentActivities,
  };
}
