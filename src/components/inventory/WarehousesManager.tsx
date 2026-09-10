"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Wh = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  stockLines: number;
  totalUnits: number;
};

export function WarehousesManager() {
  const [rows, setRows] = useState<Wh[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory/warehouses", { cache: "no-store" });
    const data = (await res.json()) as { warehouses: Wh[] };
    setRows(data.warehouses ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/inventory/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim() || null,
        isDefault: rows.length === 0,
      }),
    });
    if (!res.ok) {
      alert("Could not create warehouse");
      return;
    }
    setName("");
    setCode("");
    void load();
  }

  async function setDefault(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const res = await fetch(`/api/inventory/warehouses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.name,
        code: row.code,
        isDefault: true,
      }),
    });
    if (!res.ok) alert("Could not update");
    void load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Warehouses</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Track stock by location. Opening stock and adjustments post against these warehouses.
      </p>

      <form
        onSubmit={create}
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="Warehouse name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-40 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="Code (optional)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          Add warehouse
        </button>
      </form>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Stock lines</th>
              <th className="px-4 py-3">Qty on hand</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  A default warehouse is created when you open this page.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {r.name}
                    {r.isDefault ? (
                      <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        Default
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.code ?? "—"}</td>
                  <td className="px-4 py-3">{r.stockLines}</td>
                  <td className="px-4 py-3 tabular-nums">{r.totalUnits}</td>
                  <td className="px-4 py-3 text-right">
                    {!r.isDefault ? (
                      <button
                        type="button"
                        onClick={() => void setDefault(r.id)}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
                      >
                        Set default
                      </button>
                    ) : null}
                    <Link href={`/dashboard/inventory/warehouses/${r.id}`} className="ml-3 text-sm font-medium text-slate-600 hover:text-teal-600 dark:text-slate-400">
                      Details
                    </Link>
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
