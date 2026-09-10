"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import { RecurringExpenseActionsCell } from "@/components/purchases/RecurringExpenseActionsCell";

function humanFrequency(f: string) {
  const m: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
  return m[f] ?? f;
}

type Row = {
  id: string;
  frequency: string;
  nextRunDate: string;
  isActive: boolean;
  amount: number;
  notes: string | null;
  vendorName: string | null;
  customerName: string | null;
  expenseAccountCode: string;
  bankAccountCode: string;
};

export function RecurringExpensesClient() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/recurring-expenses", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ recurringExpenses?: Row[] }>(res, {});
      setRows(data.recurringExpenses ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Recurring expenses</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Templates scheduled daily / weekly / monthly. Run{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">POST /api/cron/recurring-purchases</code> on a cron job.
          </p>
        </div>
        <Link href="/dashboard/purchases/recurring-expenses/new" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500">
          Add template
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left">Frequency</th>
              <th className="px-4 py-3 text-left">Next run</th>
              <th className="px-4 py-3 text-left">Expense acct</th>
              <th className="px-4 py-3 text-left">Bank</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3">{humanFrequency(r.frequency)}</td>
                <td className="px-4 py-3 tabular-nums">{r.nextRunDate.slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.expenseAccountCode}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.bankAccountCode}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">{r.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <RecurringExpenseActionsCell
                    recurringId={r.id}
                    frequency={r.frequency}
                    nextRunDate={r.nextRunDate}
                    amount={r.amount}
                    expenseAccountCode={r.expenseAccountCode}
                    bankAccountCode={r.bankAccountCode}
                    vendorName={r.vendorName}
                    customerName={r.customerName}
                    notes={r.notes}
                    isActive={r.isActive}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
