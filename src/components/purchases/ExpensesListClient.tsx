"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExpenseActionsCell } from "@/components/purchases/ExpenseActionsCell";
import { parseResponseJson } from "@/lib/parse-response-json";

export function ExpensesListClient() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      expenseDate: string;
      amount: number;
      taxAmount: number;
      notes: string | null;
      expenseAccountCode: string;
      bankAccountCode: string;
      posted: boolean;
    }>
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/expenses", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ expenses?: typeof rows }>(res, {});
      setRows(data.expenses ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Expenses</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Direct spend — Dr expense, Cr bank (with GST input).</p>
        </div>
        <Link href="/dashboard/purchases/expenses/new" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500">
          Record expense
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Expense acct</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Bank</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3">Posted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3 tabular-nums">{r.expenseDate.slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.expenseAccountCode}</td>
                <td
                  className="max-w-[min(28rem,40vw)] px-4 py-3 text-slate-700 dark:text-slate-300"
                  title={r.notes?.trim() || undefined}
                >
                  <span className="line-clamp-2 break-words">{r.notes?.trim() || "—"}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.bankAccountCode}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.taxAmount.toFixed(2)}</td>
                <td className="px-4 py-3">{r.posted ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <ExpenseActionsCell
                    expenseId={r.id}
                    expenseDate={r.expenseDate}
                    expenseAccountCode={r.expenseAccountCode}
                    bankAccountCode={r.bankAccountCode}
                    amount={r.amount}
                    taxAmount={r.taxAmount}
                    notes={r.notes}
                    posted={r.posted}
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
