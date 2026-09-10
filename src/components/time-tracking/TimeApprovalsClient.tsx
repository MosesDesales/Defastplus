"use client";

import { useCallback, useEffect, useState } from "react";

type Timesheet = {
  id: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalSeconds: number;
};

export function TimeApprovalsClient() {
  const [rows, setRows] = useState<Timesheet[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/time-tracking/timesheets?status=SUBMITTED", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load timesheets");
      return;
    }
    const j = await res.json();
    setRows(j.timesheets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, approved: boolean) {
    const res = await fetch(`/api/time-tracking/timesheets/${id}/review`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, reviewNotes: notes[id]?.trim() || null }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Not allowed or failed");
      return;
    }
    void load();
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Approvals</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Managers and admins can approve or reject submitted timesheets (permission: time.approve, hr.*, or *).
        </p>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <ul className="space-y-4">
        {rows.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{s.employeeName}</p>
                <p className="text-sm text-slate-500">
                  {s.periodStart.slice(0, 10)} → {s.periodEnd.slice(0, 10)} · {(s.totalSeconds / 3600).toFixed(2)} h
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white"
                  onClick={() => void review(s.id, true)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                  onClick={() => void review(s.id, false)}
                >
                  Reject
                </button>
              </div>
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-slate-500">Notes to employee (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
              />
            </label>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="text-sm text-slate-500">No submitted timesheets waiting for review.</p> : null}
    </div>
  );
}
