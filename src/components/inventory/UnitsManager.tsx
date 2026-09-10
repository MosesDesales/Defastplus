"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

type Unit = { id: string; name: string; abbreviation: string; itemCount: number };

export function UnitsManager() {
  const [rows, setRows] = useState<Unit[]>([]);
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbbr, setEditAbbr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory/units", { cache: "no-store" });
    const data = (await res.json()) as { units: Unit[] };
    setRows(data.units ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/inventory/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), abbreviation: abbr.trim() || null }),
    });
    if (!res.ok) {
      alert("Could not create unit");
      return;
    }
    setName("");
    setAbbr("");
    void load();
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    const res = await fetch(`/api/inventory/units/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), abbreviation: editAbbr.trim() || null }),
    });
    if (!res.ok) {
      alert("Could not update");
      return;
    }
    setEditId(null);
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this unit? Items using it will fall back to custom unit text.")) return;
    const res = await fetch(`/api/inventory/units/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete");
      return;
    }
    void load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Units</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nos, Kg, Liters — used on item records.</p>

      <form
        onSubmit={create}
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          className="min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="Name (e.g. Kilogram)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-32 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="Abbr (Kg)"
          value={abbr}
          onChange={(e) => setAbbr(e.target.value)}
        />
        <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          Add unit
        </button>
      </form>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Abbreviation</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No units yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {editId === r.id ? (
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === r.id ? (
                      <input
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        value={editAbbr}
                        onChange={(e) => setEditAbbr(e.target.value)}
                      />
                    ) : (
                      r.abbreviation || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.itemCount}</td>
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
                          setEditAbbr(r.abbreviation);
                        }}
                        className="mr-2 inline-flex items-center text-slate-600 hover:text-teal-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(r.id)} className="inline-flex text-slate-600 hover:text-red-600">
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
