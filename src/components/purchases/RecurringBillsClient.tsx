"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

export function RecurringBillsClient() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      vendorName: string;
      profileName: string;
      frequency: string;
      nextRunDate: string;
      isActive: boolean;
      lineCount: number;
    }>
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/recurring-bills", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ recurringBills?: typeof rows }>(res, {});
      setRows(data.recurringBills ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Recurring bills</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Auto-create vendor bills on a schedule. Uses the same cron endpoint as recurring expenses.
          </p>
        </div>
        <Link href="/dashboard/purchases/recurring-bills/new" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500">
          Add template
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left">Profile</th>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Frequency</th>
              <th className="px-4 py-3 text-left">Next run</th>
              <th className="px-4 py-3">Lines</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.profileName || "—"}</td>
                <td className="px-4 py-3">{r.vendorName}</td>
                <td className="px-4 py-3">{r.frequency}</td>
                <td className="px-4 py-3 tabular-nums">{r.nextRunDate.slice(0, 10)}</td>
                <td className="px-4 py-3">{r.lineCount}</td>
                <td className="px-4 py-3">{r.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
