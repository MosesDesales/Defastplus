"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  challanNumber: string;
  challanDate: string;
  customerName: string;
  status: string;
  total: number;
};

export function DeliveryChallansListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/sales/delivery-challans", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load");
        const d = await r.json();
        setRows(d.challans ?? []);
      })
      .catch(() => setErr("Could not load delivery challans"));
  }, []);

  if (err) return <p className="mt-6 text-sm text-red-600">{err}</p>;

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-950">
          <tr>
            <th className="px-3 py-2">Challan</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                No delivery challans yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link href={`/dashboard/sales/delivery-challans/${r.id}`} className="font-medium text-teal-600 hover:underline">
                    {r.challanNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.customerName}</td>
                <td className="px-3 py-2">{new Date(r.challanDate).toLocaleDateString("en-IN")}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
