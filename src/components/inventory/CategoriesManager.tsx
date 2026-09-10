"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

type Cat = { id: string; name: string; itemCount: number };

export function CategoriesManager() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory/categories", { cache: "no-store" });
    const data = (await res.json()) as { categories: Cat[] };
    setRows(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/inventory/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      alert("Could not create category");
      return;
    }
    setName("");
    void load();
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    const res = await fetch(`/api/inventory/categories/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) {
      alert("Could not update");
      return;
    }
    setEditId(null);
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Items will be unassigned.")) return;
    const res = await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete");
      return;
    }
    void load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Categories</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Group items for filters and reporting.</p>

      <form onSubmit={create} className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          Add category
        </button>
      </form>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No categories yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {editId === r.id ? (
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.itemCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editId === r.id ? (
                      <button type="button" onClick={() => void saveEdit()} className="mr-2 text-sm font-medium text-teal-600">
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(r.id);
                          setEditName(r.name);
                        }}
                        className="mr-2 inline-flex items-center gap-1 text-slate-600 hover:text-teal-600 dark:text-slate-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(r.id)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-red-600 dark:text-slate-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
