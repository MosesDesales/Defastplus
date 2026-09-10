"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PurchaseOrderActionsCell } from "@/components/purchases/PurchaseOrderActionsCell";
import { parseResponseJson } from "@/lib/parse-response-json";

export function PurchaseOrdersListClient() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      poNumber: string;
      poDate: string;
      vendorName: string;
      status: string;
      total: number;
    }>
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/purchases/purchase-orders", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ purchaseOrders?: typeof rows }>(res, {});
      setRows(data.purchaseOrders ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Purchases</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Purchase orders</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Commitments to vendors — no GL impact until billed.</p>
        </div>
        <Link href="/dashboard/purchases/purchase-orders/new" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500">
          New PO
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">PO</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/dashboard/purchases/purchase-orders/${r.id}`} className="text-teal-600 hover:underline dark:text-teal-400">
                    {r.poNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.vendorName}</td>
                <td className="px-4 py-3 tabular-nums">{r.poDate.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-xs">{r.status}</td>
                <td className="px-4 py-3 text-right">
                  <PurchaseOrderActionsCell
                    poId={r.id}
                    poNumber={r.poNumber}
                    vendorName={r.vendorName}
                    poDate={r.poDate}
                    status={r.status}
                    total={r.total}
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
