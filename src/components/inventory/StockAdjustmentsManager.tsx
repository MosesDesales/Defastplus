"use client";

import { useCallback, useEffect, useState } from "react";

type ItemOpt = { id: string; name: string; sku: string | null };
type WhOpt = { id: string; name: string };

type AdjRow = {
  id: string;
  createdAt: string;
  itemName: string;
  sku: string | null;
  warehouseName: string;
  quantityDelta: number;
  reason: string;
};

export function StockAdjustmentsManager() {
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [warehouses, setWarehouses] = useState<WhOpt[]>([]);
  const [history, setHistory] = useState<AdjRow[]>([]);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    const [it, wh, adj] = await Promise.all([
      fetch("/api/inventory/items").then((r) => r.json()),
      fetch("/api/inventory/warehouses").then((r) => r.json()),
      fetch("/api/inventory/stock-adjustments").then((r) => r.json()),
    ]);
    const itemRows = (it.items ?? []) as {
      id: string;
      name: string;
      sku: string | null;
    }[];
    setItems(itemRows.map((x) => ({ id: x.id, name: x.name, sku: x.sku })));
    setWarehouses((wh.warehouses ?? []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
    setHistory(adj.adjustments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = Number.parseFloat(delta);
    if (!itemId || !warehouseId || Number.isNaN(d) || !reason.trim()) {
      alert("Select item and warehouse, enter quantity change (+/-), and reason.");
      return;
    }
    const res = await fetch("/api/inventory/stock-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        warehouseId,
        quantityDelta: d,
        reason: reason.trim(),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "Adjustment failed");
      return;
    }
    setDelta("");
    setReason("");
    void loadMeta();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Stock adjustments</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Increase or decrease on-hand quantity. A reason is required for audit trail.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">New adjustment</h2>
        <form onSubmit={(e) => void submit(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Item</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Select item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.sku ? ` (${i.sku})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Warehouse</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Quantity change (+ / −)</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="number"
              step="any"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 10 or -3"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Reason (required)</label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Damaged goods, cycle count, transfer correction…"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
              Post adjustment
            </button>
          </div>
        </form>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 dark:text-white">Recent adjustments</h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3 text-right">Δ Qty</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No adjustments yet.
                </td>
              </tr>
            ) : (
              history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {new Date(h.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{h.itemName}</td>
                  <td className="px-4 py-3">{h.warehouseName}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    <span className={h.quantityDelta >= 0 ? "text-emerald-600" : "text-rose-600"}>{h.quantityDelta >= 0 ? "+" : ""}
                    {h.quantityDelta}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600 dark:text-slate-400" title={h.reason}>
                    {h.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
