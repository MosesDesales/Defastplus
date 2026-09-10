"use client";

import { useState } from "react";

const TYPES = [
  { value: "employee_hours", label: "Employee hours" },
  { value: "billable_split", label: "Billable vs non-billable" },
  { value: "profitability", label: "Project profitability (revenue)" },
  { value: "timesheet_summary", label: "Timesheet summary" },
  { value: "productivity", label: "Productivity by day" },
] as const;

export function TimeReportsClient() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("employee_hours");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    const q = new URLSearchParams({ type, from, to });
    const res = await fetch(`/api/time-tracking/reports?${q}`, { credentials: "include" });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Failed");
      return;
    }
    setData(await res.json());
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Reports</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Exports-friendly summaries for operations and billing.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="text-sm">
          <span className="text-slate-600">Report</span>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number]["value"])}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">From</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">To</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white"
        >
          Run
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {data ? (
        <pre className="max-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-teal-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
