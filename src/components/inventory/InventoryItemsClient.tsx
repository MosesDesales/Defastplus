"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, PackagePlus, Search, Upload } from "lucide-react";

type Row = {
  id: string;
  name: string;
  sku: string | null;
  categoryName: string | null;
  purchaseRate: number;
  salesRate: number;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  lowStock: boolean;
  outOfStock: boolean;
  unitDisplay: string;
};

type Cat = { id: string; name: string };

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function InventoryItemsClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (categoryId) p.set("categoryId", categoryId);
    if (stock !== "all") p.set("stock", stock);
    return p.toString();
  }, [debouncedSearch, categoryId, stock]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catRes] = await Promise.all([
        fetch(`/api/inventory/items${query ? `?${query}` : ""}`, { cache: "no-store" }),
        fetch("/api/inventory/categories", { cache: "no-store" }),
      ]);
      const itemsJson = (await itemsRes.json()) as { items: Row[] };
      const catJson = (await catRes.json()) as { categories: Cat[] };
      setItems(itemsJson.items ?? []);
      setCategories(catJson.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const header = [
      "name",
      "sku",
      "category",
      "purchaseRate",
      "salesRate",
      "stockQuantity",
      "unit",
      "status",
    ];
    const lines = items.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.sku ?? "",
        r.categoryName ?? "",
        r.purchaseRate,
        r.salesRate,
        r.stockQuantity,
        r.unitDisplay,
        r.isActive ? "Active" : "Inactive",
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await fetch("/api/inventory/items/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const data = (await res.json()) as { created?: number; errors?: string[] };
    if (!res.ok) {
      alert((data as { error?: string }).error ?? "Import failed");
      return;
    }
    alert(`Imported ${data.created ?? 0} items.${data.errors?.length ? ` Issues: ${data.errors.join("; ")}` : ""}`);
    void load();
    e.target.value = "";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Items</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Manage SKUs, pricing, categories, and stock levels across warehouses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Import
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(ev) => void onImportFile(ev)} />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link
            href="/dashboard/inventory/items/new"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            <PackagePlus className="h-4 w-4" />
            Add item
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or SKU"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-teal-600/20 focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          <div className="w-full min-w-[160px] md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full min-w-[160px] md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Stock</label>
            <select
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">All</option>
              <option value="in_stock">In stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="low_stock">Low / reorder</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Purchase</th>
                <th className="px-4 py-3 text-right">Selling</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No items match your filters.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="text-slate-800 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                        {r.lowStock ? (
                          <span title="At or below reorder level">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                          </span>
                        ) : null}
                        {r.name}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.unitDisplay}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">{r.sku ?? "—"}</td>
                    <td className="px-4 py-3">{r.categoryName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.purchaseRate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.salesRate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.stockQuantity}
                      {r.outOfStock ? (
                        <span className="ml-2 text-xs text-rose-600 dark:text-rose-400">empty</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.isActive
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/inventory/items/${r.id}/edit`}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
                      >
                        Edit
                      </Link>
                    </td>
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
