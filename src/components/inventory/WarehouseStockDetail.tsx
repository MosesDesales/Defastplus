"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

type WarehousePayload = {
  name: string;
  code: string | null;
  isDefault: boolean;
  lines: {
    itemId: string;
    itemName: string;
    sku: string | null;
    quantity: number;
    purchaseRate: number;
  }[];
};

export function WarehouseStockDetail({ warehouseId }: { warehouseId: string }) {
  const [data, setData] = useState<WarehousePayload | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory/warehouses/${warehouseId}`, { cache: "no-store" });
    if (!res.ok) {
      setData(null);
      return;
    }
    const json = (await res.json()) as { warehouse: WarehousePayload };
    setData(json.warehouse);
  }, [warehouseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return <p className="px-4 py-12 text-center text-slate-500">Warehouse not found.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/inventory/warehouses" className="text-sm font-medium text-teal-600 dark:text-teal-400">
        ← Warehouses
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{data.name}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {data.code ? `Code: ${data.code}` : "No code"}
        {data.isDefault ? (
          <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
            Default
          </span>
        ) : null}
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Purchase rate</th>
              <th className="px-4 py-3 text-right">Ext. cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No stock rows for this warehouse.
                </td>
              </tr>
            ) : (
              data.lines.map((l) => (
                <tr key={l.itemId}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{l.itemName}</td>
                  <td className="px-4 py-3">{l.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(l.purchaseRate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(l.quantity * l.purchaseRate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
