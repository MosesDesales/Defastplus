"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  itemId: string;
  name: string;
  sku: string | null;
  categoryName: string | null;
  quantityOnHand: number;
  unitCost: number;
  lineValue: number;
  methodHint: string;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export function ValuationReport() {
  const [method, setMethod] = useState<"FIFO" | "WEIGHTED_AVERAGE">("WEIGHTED_AVERAGE");
  const [savedMethod, setSavedMethod] = useState<"FIFO" | "WEIGHTED_AVERAGE">("WEIGHTED_AVERAGE");
  const [rows, setRows] = useState<Row[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshValuation = useCallback(async (m: "FIFO" | "WEIGHTED_AVERAGE") => {
    setLoading(true);
    const vRes = await fetch(`/api/inventory/valuation?method=${m}`, { cache: "no-store" });
    const v = (await vRes.json()) as { rows: Row[]; totalValue: number; valuationMethod: string };
    setRows(v.rows ?? []);
    setTotalValue(v.totalValue ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const sRes = await fetch("/api/inventory/settings", { cache: "no-store" });
      const s = (await sRes.json()) as { valuationMethod: "FIFO" | "WEIGHTED_AVERAGE" };
      setSavedMethod(s.valuationMethod);
      setMethod(s.valuationMethod);
      await refreshValuation(s.valuationMethod);
    })();
  }, [refreshValuation]);

  async function onMethodChange(m: "FIFO" | "WEIGHTED_AVERAGE") {
    setMethod(m);
    await refreshValuation(m);
  }

  async function saveDefaultMethod() {
    const res = await fetch("/api/inventory/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valuationMethod: method }),
    });
    if (!res.ok) {
      alert("Could not save settings");
      return;
    }
    const s = (await res.json()) as { valuationMethod: "FIFO" | "WEIGHTED_AVERAGE" };
    setSavedMethod(s.valuationMethod);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Inventory valuation</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Stock value for goods items using purchase rate as unit cost. FIFO and weighted average match this MVP until layered costing exists — your selection drives labels and the saved default.
      </p>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Preview method</label>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={method}
            onChange={(e) => void onMethodChange(e.target.value as "FIFO" | "WEIGHTED_AVERAGE")}
          >
            <option value="WEIGHTED_AVERAGE">Weighted average</option>
            <option value="FIFO">FIFO</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Saved default: <span className="font-medium text-slate-700 dark:text-slate-300">{savedMethod}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveDefaultMethod()}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Save preview as default
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/50 px-6 py-4 dark:border-teal-900 dark:bg-teal-950/30">
        <p className="text-sm text-teal-900 dark:text-teal-100">
          Total inventory value ({method.replace("_", " ").toLowerCase()}):{" "}
          <span className="text-lg font-semibold tabular-nums">{formatMoney(totalValue)}</span>
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit cost</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No goods items with stock.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.itemId}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{r.sku ?? "—"}</td>
                  <td className="px-4 py-3">{r.categoryName ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.quantityOnHand}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.unitCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(r.lineValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
