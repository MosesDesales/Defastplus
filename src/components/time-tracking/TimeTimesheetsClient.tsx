"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; displayName: string };
type Entry = {
  id: string;
  employeeName: string;
  projectName: string | null;
  taskName: string | null;
  durationSeconds: number;
  liveDurationSeconds?: number;
  billable: boolean;
  workDate: string;
  timesheetId: string | null;
  invoiceId: string | null;
  projectId?: string | null;
  isRunning?: boolean;
};
type Timesheet = {
  id: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalSeconds: number;
};

function weekRange(anchor: Date) {
  const s = new Date(anchor);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
}

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TimeTimesheetsClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [anchor, setAnchor] = useState(() => new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sheets, setSheets] = useState<Timesheet[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [invMsg, setInvMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(() => toYmd(weekRange(new Date()).start));
  const [periodEnd, setPeriodEnd] = useState(() => toYmd(weekRange(new Date()).end));

  const range = useMemo(() => {
    const a = new Date(anchor);
    if (view === "daily") {
      const d = new Date(a);
      d.setHours(12, 0, 0, 0);
      return { from: toYmd(d), to: toYmd(d) };
    }
    if (view === "weekly") {
      const { start, end } = weekRange(a);
      return { from: toYmd(start), to: toYmd(end) };
    }
    const s = new Date(a.getFullYear(), a.getMonth(), 1);
    const e = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { from: toYmd(s), to: toYmd(e) };
  }, [anchor, view]);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/hr/employees", { credentials: "include" });
    if (!res.ok) return;
    const j = await res.json();
    const list = (j.employees ?? []).map((e: { id: string; displayName: string }) => ({ id: e.id, displayName: e.displayName }));
    setEmployees(list);
    if (!employeeId && list[0]) setEmployeeId(list[0].id);
  }, [employeeId]);

  const loadEntries = useCallback(async () => {
    if (!employeeId) return;
    setErr(null);
    const q = new URLSearchParams({ employeeId, from: range.from, to: range.to, limit: "500" });
    const res = await fetch(`/api/time-tracking/entries?${q}`, { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load entries");
      return;
    }
    const j = await res.json();
    setEntries(j.entries ?? []);
  }, [employeeId, range.from, range.to]);

  const loadSheets = useCallback(async () => {
    const q = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    const res = await fetch(`/api/time-tracking/timesheets${q}`, { credentials: "include" });
    if (!res.ok) return;
    const j = await res.json();
    setSheets(j.timesheets ?? []);
  }, [employeeId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadEntries();
    void loadSheets();
  }, [loadEntries, loadSheets]);

  async function createTimesheet(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    const res = await fetch("/api/time-tracking/timesheets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, periodStart, periodEnd }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not create timesheet");
      return;
    }
    void loadSheets();
  }

  async function createInvoiceFromSelection() {
    setInvMsg(null);
    const entryIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!entryIds.length) return;
    const res = await fetch("/api/time-tracking/invoice-from-entries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds, taxPercent: 0 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setInvMsg(j.error ?? "Could not create invoice");
      return;
    }
    setInvMsg(`Draft invoice ${j.invoiceNumber} created.`);
    setSelected({});
    void loadEntries();
  }

  async function submitSheet(id: string) {
    const res = await fetch(`/api/time-tracking/timesheets/${id}/submit`, { method: "POST", credentials: "include" });
    if (!res.ok) return;
    void loadSheets();
  }

  function eligibleForInvoice(r: Entry) {
    return r.billable && !r.invoiceId && !!r.projectId && !r.isRunning;
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Timesheets</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Daily, weekly, and monthly entry grids with submission workflow.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-slate-600 dark:text-slate-400">Employee</span>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600 dark:text-slate-400">View</span>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600 dark:text-slate-400">Anchor date</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={toYmd(anchor)}
            onChange={(e) => setAnchor(new Date(e.target.value + "T12:00:00"))}
          />
        </label>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {invMsg ? <p className="text-sm text-teal-700 dark:text-teal-300">{invMsg}</p> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
          {range.from} → {range.to}
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="w-10 px-2 py-2" aria-label="Select for invoice" />
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Task</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2">Billable h</th>
              <th className="px-4 py-2">Sheet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-2">
                  {eligibleForInvoice(r) ? (
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={() => setSelected((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                      aria-label="Select for invoice"
                    />
                  ) : null}
                </td>
                <td className="px-4 py-2">{r.employeeName}</td>
                <td className="px-4 py-2">{r.projectName ?? "—"}</td>
                <td className="px-4 py-2">{r.taskName ?? "—"}</td>
                <td className="px-4 py-2">{r.workDate.slice(0, 10)}</td>
                <td className="px-4 py-2 tabular-nums">{((r.liveDurationSeconds ?? r.durationSeconds) / 3600).toFixed(2)}</td>
                <td className="px-4 py-2 tabular-nums">{r.billable ? ((r.liveDurationSeconds ?? r.durationSeconds) / 3600).toFixed(2) : "—"}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {r.timesheetId ? r.timesheetId.slice(0, 8) + "…" : "—"}
                  {r.invoiceId ? <span className="ml-1 text-teal-600">Invoiced</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length ? <p className="p-4 text-sm text-slate-500">No entries in this range.</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Billable hours → invoice</h2>
        <p className="mt-1 text-xs text-slate-500">
          Select finished, billable rows with a project. If entries are on a timesheet, it must be approved before invoicing.
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          onClick={() => void createInvoiceFromSelection()}
        >
          Create draft sales invoice
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Timesheet periods</h2>
        <form onSubmit={createTimesheet} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Period start</span>
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Period end</span>
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">
            Create timesheet
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {sheets.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{s.employeeName}</p>
                <p className="text-xs text-slate-500">
                  {s.periodStart.slice(0, 10)} → {s.periodEnd.slice(0, 10)} · {(s.totalSeconds / 3600).toFixed(2)} h · {s.status}
                </p>
              </div>
              {s.status === "DRAFT" || s.status === "REJECTED" ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:border-teal-500 dark:border-slate-600"
                  onClick={() => void submitSheet(s.id)}
                >
                  Submit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
