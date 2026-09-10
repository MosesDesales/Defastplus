"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

export function VendorProfileClient({ vendorId }: { vendorId: string }) {
  const [data, setData] = useState<{
    displayName: string;
    totalPayables: number;
    overdueBillCount: number;
    bills: Array<{
      id: string;
      billNumber: string;
      billDate: string;
      dueDate: string | null;
      total: number;
      paid: number;
      balance: number;
      status: string;
    }>;
    payments: Array<{
      id: string;
      paymentNumber: string;
      paymentDate: string;
      amount: number;
      mode: string;
      reference: string | null;
    }>;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/purchases/vendors/${vendorId}/summary`, { cache: "no-store" });
      const j = await parseResponseJson<Record<string, unknown>>(res, {});
      if (!res.ok || typeof j.displayName !== "string") {
        setData(null);
        return;
      }
      setData(j as NonNullable<typeof data>);
    })();
  }, [vendorId]);

  if (!data) return <p className="px-4 py-8 text-slate-500">Loading…</p>;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/purchases/vendors" className="text-sm font-medium text-teal-600 dark:text-teal-400">
        ← Vendors
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Vendor</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{data.displayName}</h1>
        <Link
          href={`/dashboard/purchases/vendors/${vendorId}/edit`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Edit
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Total payables</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{fmt(data.totalPayables)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Overdue bills</p>
          <p className="mt-2 text-xl font-semibold text-amber-700 dark:text-amber-400">{data.overdueBillCount}</p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Bills</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Bill</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/dashboard/purchases/bills/${b.id}`} className="text-teal-600 hover:underline dark:text-teal-400">
                      {b.billNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{b.billDate.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(b.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(b.balance)}</td>
                  <td className="px-4 py-3 text-xs">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Payments made</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs">{p.paymentNumber}</td>
                    <td className="px-4 py-3 tabular-nums">{p.paymentDate.slice(0, 10)}</td>
                    <td className="px-4 py-3">{p.mode}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(p.amount)}</td>
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
