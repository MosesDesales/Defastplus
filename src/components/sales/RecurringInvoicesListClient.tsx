"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Row = {
  id: string;
  customerName: string;
  profileName: string;
  frequency: string;
  repeatEvery: number;
  nextRunDate: string;
  status: string;
  autoEmail: boolean;
};

export function RecurringInvoicesListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sales/recurring-invoices", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ recurringInvoices?: Row[] }>(res, {});
    setRows(data.recurringInvoices ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: "ACTIVE" | "PAUSED" | "STOPPED") {
    setBusy(id);
    try {
      const res = await fetch(`/api/sales/recurring-invoices/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await parseResponseJson<{ error?: string }>(res, {});
        alert(d.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runNow(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/sales/recurring-invoices/${id}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await parseResponseJson<{ error?: string; invoiceNumber?: string }>(res, {});
      if (!res.ok) {
        alert(data.error ?? "Run failed");
        return;
      }
      alert(`Created invoice ${data.invoiceNumber ?? ""}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-10 text-sm text-slate-500">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-slate-200 px-8 py-16 text-center dark:border-slate-700">
        <p className="text-slate-600 dark:text-slate-400">No recurring invoice templates yet.</p>
        <Link href="/dashboard/sales/recurring-invoices/new" className="mt-4 inline-block text-sm font-medium text-teal-600 dark:text-teal-400">
          Create template
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Profile</th>
            <th className="px-4 py-3">Frequency</th>
            <th className="px-4 py-3">Next run</th>
            <th className="px-4 py-3">Auto email</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.customerName}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.profileName || "—"}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                every {r.repeatEvery} {r.frequency.toLowerCase()}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">{r.nextRunDate.slice(0, 10)}</td>
              <td className="px-4 py-3">{r.autoEmail ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{r.status}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  {r.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void patchStatus(r.id, "PAUSED")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Pause
                    </button>
                  ) : null}
                  {r.status === "PAUSED" ? (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void patchStatus(r.id, "ACTIVE")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Resume
                    </button>
                  ) : null}
                  {r.status !== "STOPPED" ? (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void patchStatus(r.id, "STOPPED")}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy === r.id || r.status === "STOPPED"}
                    onClick={() => void runNow(r.id)}
                    className="rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40 dark:bg-teal-500"
                  >
                    Run now
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
