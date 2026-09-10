"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  entryDate: string;
  referenceNo: string | null;
  memo: string | null;
  postingStatus: string;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
};

export function ManualJournalListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/journals", { cache: "no-store" });
    const data = (await res.json()) as { journals?: Row[] };
    setRows(data.journals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function postDraft(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/accounting/journals/${id}/post`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not post.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeDraft(id: string) {
    if (!confirm("Delete this draft journal?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/accounting/journals/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not delete.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Journal entries</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Double-entry journals — drafts can be edited until posted.
          </p>
        </div>
        <Link
          href="/dashboard/accounting/manual-journal/new"
          className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          New journal
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Memo</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No manual journals yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-900 dark:text-white">
                      {r.entryDate.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {r.referenceNo ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.postingStatus === "POSTED"
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        }
                      >
                        {r.postingStatus === "POSTED" ? "Posted" : "Draft"}
                      </span>
                    </td>
                    <td className="hidden max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-400 md:table-cell">
                      {r.memo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.totalDebit.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.totalCredit.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/accounting/manual-journal/${r.id}/edit`}
                        className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                      >
                        View
                      </Link>
                      {r.postingStatus === "DRAFT" ? (
                        <>
                          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void postDraft(r.id)}
                            className="font-medium text-slate-700 hover:underline disabled:opacity-50 dark:text-slate-300"
                          >
                            Post
                          </button>
                          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void removeDraft(r.id)}
                            className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
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
