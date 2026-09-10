"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BillActionsCell } from "@/components/purchases/BillActionsCell";
import { parseResponseJson } from "@/lib/parse-response-json";

type DashboardData = {
  totalPayables: number;
  overdueBillCount: number;
  openBillCount: number;
  expenseMonthTotal: number;
  recentBills: Array<{
    id: string;
    billNumber: string;
    vendorName: string;
    vendorEmail?: string | null;
    total: number;
    balance: number;
    status: string;
    billDate: string;
  }>;
};

export function PurchasesHomeClient() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/dashboard/summary", { cache: "no-store" });
      const j = await parseResponseJson<Record<string, unknown>>(res, {});
      if (!res.ok || j.error) {
        setData(null);
        return;
      }
      setData(j as DashboardData);
    })();
  }, []);

  if (!data) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Overview</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Payables, bills, and spend — aligned with double-entry accounts payable.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Total payables</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {fmt(data.totalPayables)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Overdue bills</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-400">
            {data.overdueBillCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Open bills</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{data.openBillCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Expenses (MTD)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {fmt(data.expenseMonthTotal)}
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent bills</h2>
          <Link href="/dashboard/purchases/bills/new" className="text-sm font-medium text-teal-600 dark:text-teal-400">
            New bill
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Bill</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No bills yet.
                  </td>
                </tr>
              ) : (
                data.recentBills.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/dashboard/purchases/bills/${b.id}`} className="text-teal-600 hover:underline dark:text-teal-400">
                        {b.billNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{b.vendorName}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{b.billDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(b.total)}</td>
                    <td className="px-4 py-3">
                      <BillBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BillActionsCell
                        billId={b.id}
                        billNumber={b.billNumber}
                        vendorName={b.vendorName}
                        vendorEmail={b.vendorEmail ?? null}
                        billDate={b.billDate.slice(0, 10)}
                        total={b.total.toFixed(2)}
                        balance={b.balance.toFixed(2)}
                        status={b.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BillBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    UNPAID: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    PARTIALLY_PAID: "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
    DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    VOID: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.UNPAID}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
