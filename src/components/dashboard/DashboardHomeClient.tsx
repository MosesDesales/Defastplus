"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardSummary } from "@/lib/dashboard-summary";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const rupee = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatInr(n: number) {
  return rupee.format(n);
}

function shortInr(n: number) {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return formatInr(n);
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={cx(
        "text-xs font-medium tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({
  title,
  amount,
  trend,
  accent,
  footnote,
}: {
  title: string;
  amount: number;
  trend: number | null;
  accent: "income" | "expense" | "neutral" | "alert";
  footnote?: string;
}) {
  const ring =
    accent === "income"
      ? "ring-emerald-100/80 dark:ring-emerald-900/40"
      : accent === "expense"
        ? "ring-rose-100/80 dark:ring-rose-900/40"
        : accent === "alert"
          ? "ring-amber-100/80 dark:ring-amber-900/40"
          : "ring-slate-100 dark:ring-slate-800";

  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        "ring-1",
        ring,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {formatInr(amount)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Trend pct={trend} />
        <span className="text-right text-[10px] text-slate-400 dark:text-slate-500">{footnote ?? "vs prior 30d"}</span>
      </div>
    </div>
  );
}

const CHART_COLORS = {
  sales: "#0d9488",
  expenses: "#f43f5e",
  inflow: "#14b8a6",
  outflow: "#64748b",
  pending: "#f59e0b",
  collected: "#10b981",
};

export function DashboardHomeClient({
  initial,
  userName,
}: {
  initial: DashboardSummary;
  userName: string;
}) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as DashboardSummary;
        setData(json);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const rSplit = data.receivablesSplit;
  const receivablePie =
    rSplit.pending + rSplit.collected > 0
      ? [
          { name: "Outstanding", value: rSplit.pending },
          { name: "Collected", value: rSplit.collected },
        ]
      : [];

  const pSplit = data.payablesSplit;
  const payablePie =
    pSplit.pending + pSplit.paid > 0
      ? [
          { name: "Payables due", value: pSplit.pending },
          { name: "Paid", value: pSplit.paid },
        ]
      : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">Home</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Hello, {userName}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Performance overview · <span className="font-medium text-slate-800 dark:text-slate-200">{data.periodLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {refreshing ? "Refreshing…" : "Refresh data"}
        </button>
      </div>

      {/* KPI row */}
      <section aria-label="Summary KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Total Sales" amount={data.kpis.totalSales} trend={data.trends.salesPct} accent="income" />
        <KpiCard
          title="Total Purchases"
          amount={data.kpis.totalPurchases}
          trend={data.trends.purchasesPct}
          accent="neutral"
          footnote={!data.kpis.modules.purchases ? "Bills module soon" : undefined}
        />
        <KpiCard
          title="Total Expenses"
          amount={data.kpis.totalExpenses}
          trend={data.trends.expensesPct}
          accent="expense"
          footnote={data.kpis.modules.expensesFromJournal ? "From journals" : undefined}
        />
        <KpiCard title="Collections" amount={data.kpis.totalCollections} trend={data.trends.collectionsPct} accent="income" />
        <KpiCard title="Pending receivables" amount={data.kpis.pendingReceivables} trend={data.trends.receivablesPct} accent="alert" />
        <KpiCard
          title="Payables"
          amount={data.kpis.payables}
          trend={data.trends.payablesPct}
          accent="expense"
          footnote={!data.kpis.modules.payables ? "Vendor bills soon" : undefined}
        />
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sales vs expenses</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Monthly comparison (issued sales vs expense journals)</p>
          <div className="mt-4 h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-slate-500" />
                <YAxis tickFormatter={(v) => shortInr(Number(v))} tick={{ fontSize: 11 }} className="fill-slate-500" width={56} />
                <Tooltip
                  formatter={(value, name) => [
                    formatInr(Number(value ?? 0)),
                    name === "sales" ? "Sales" : "Expenses",
                  ]}
                  labelClassName="text-slate-900 dark:text-slate-100"
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill={CHART_COLORS.sales} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.expenses} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cash flow</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Customer receipts vs expense outflows</p>
          <div className="mt-4 h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.cashFlowMonthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => shortInr(Number(v))} tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(value, name) => [
                    formatInr(Number(value ?? 0)),
                    name === "inflow" ? "Inflow" : "Outflow",
                  ]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Line type="monotone" dataKey="inflow" name="Inflow" stroke={CHART_COLORS.inflow} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outflow" name="Outflow" stroke={CHART_COLORS.outflow} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Receivables</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding vs collected (issued invoices)</p>
            <div className="mt-4 h-56 w-full min-w-0">
              {receivablePie.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={receivablePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {receivablePie.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? CHART_COLORS.pending : CHART_COLORS.collected} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No receivable activity yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Payables</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Paid vs due (vendor bills)</p>
            <div className="mt-4 h-56 w-full min-w-0">
              {payablePie.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={payablePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {payablePie.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? CHART_COLORS.pending : CHART_COLORS.collected} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Vendor bills are not connected yet. Payables will appear here when available.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity + quick actions */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent activity</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Latest invoices, quotes, and payments</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Reference</th>
                  <th className="pb-2 pr-3 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivities.map((row) => (
                  <tr key={row.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(row.date))}
                    </td>
                    <td className="py-2 pr-3">{row.type}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{row.reference}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatInr(row.amount)}</td>
                    <td className="py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentActivities.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No activity yet — create an invoice or record a payment.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Quick actions</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Shortcuts to common tasks</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/dashboard/sales/invoices/new"
              className="rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              Create invoice
            </Link>
            <Link
              href="/dashboard/purchases/expenses"
              className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Add expense
            </Link>
            <Link
              href="/dashboard/sales/payments-received/new"
              className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Record payment
            </Link>
            <Link
              href="/dashboard/purchases/bills"
              className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Create purchase
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Modules map to Sales (invoices, receipts), Purchases (bills & expenses), Banking, and Reports in the sidebar.
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">Tip:</span> KPI totals use rolling twelve months. Trends compare the last 30 days with the previous 30 days.
          Purchases and vendor payables show zero until those modules write to the ledger.
        </p>
      </div>
    </div>
  );
}
