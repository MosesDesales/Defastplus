"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BillActionsCell } from "@/components/purchases/BillActionsCell";
import { parseResponseJson } from "@/lib/parse-response-json";

export function BillsListClient() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      billNumber: string;
      billDate: string;
      vendorName: string;
      vendorEmail?: string | null;
      status: string;
      total: number;
      balance: number;
    }>
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/bills", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ bills?: typeof rows }>(res, {});
      setRows(data.bills ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Bills</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Vendor invoices — Dr expense / GST, Cr accounts payable.</p>
        </div>
        <Link href="/dashboard/purchases/bills/new" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500">
          New bill
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/dashboard/purchases/bills/${r.id}`} className="text-teal-600 hover:underline dark:text-teal-400">
                    {r.billNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.vendorName}</td>
                <td className="px-4 py-3 tabular-nums">{r.billDate.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.balance.toFixed(2)}</td>
                <td className="px-4 py-3 text-xs">{r.status}</td>
                <td className="px-4 py-3 text-right">
                  <BillActionsCell
                    billId={r.id}
                    billNumber={r.billNumber}
                    vendorName={r.vendorName}
                    vendorEmail={r.vendorEmail ?? null}
                    billDate={r.billDate.slice(0, 10)}
                    total={r.total.toFixed(2)}
                    balance={r.balance.toFixed(2)}
                    status={r.status}
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
