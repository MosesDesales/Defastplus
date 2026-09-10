"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

export function BillDetailClient({ billId }: { billId: string }) {
  const [bill, setBill] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/purchases/bills/${billId}`, { cache: "no-store" });
      const j = await parseResponseJson<{ bill?: Record<string, unknown> }>(res, {});
      if (!res.ok || !j.bill) setBill(null);
      else setBill(j.bill);
    })();
  }, [billId]);

  if (!bill) return <p className="px-4 py-8 text-slate-500">Loading…</p>;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const lines = bill.lines as Array<Record<string, unknown>>;
  const vendor = bill.vendor as { displayName: string };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/purchases/bills" className="text-sm font-medium text-teal-600 dark:text-teal-400">
        ← Bills
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Bill</p>
      <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{String(bill.billNumber)}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{vendor.displayName}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-semibold">{fmt(Number(bill.total))}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Balance</p>
          <p className="text-lg font-semibold">{fmt(Number(bill.balance))}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Status</p>
          <p className="text-lg font-semibold">{String(bill.status)}</p>
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={String(l.id)} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3">{String(l.description)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(l.lineNet))}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(l.lineTax))}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
