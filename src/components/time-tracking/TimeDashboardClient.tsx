"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardPayload = {
  today: { totalSeconds: number; billableSeconds: number; nonBillableSeconds: number };
  activeTimers: number;
  week: { start: string; end: string; byDay: Record<string, { total: number; billable: number }> };
  recentEntries: Array<{
    id: string;
    employeeName: string;
    projectName: string;
    taskName: string | null;
    durationSeconds: number;
    billable: boolean;
    workDate: string;
    isRunning: boolean;
  }>;
  projectProgress: Array<{
    id: string;
    name: string;
    customerName: string;
    loggedSeconds: number;
    budgetHours: number | null;
    progressPercent: number;
  }>;
  teamToday: Array<{ employeeId: string; name: string; entries: number }>;
};

function fmtH(sec: number) {
  return (sec / 3600).toFixed(2);
}

export function TimeDashboardClient() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/time-tracking/dashboard", { credentials: "include" });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not load dashboard");
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const days = Object.keys(data.week.byDay).sort();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Today&apos;s totals, live timers, and a snapshot of the current week.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Hours today</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{fmtH(data.today.totalSeconds)} h</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Billable</p>
          <p className="mt-2 text-2xl font-semibold text-teal-700 dark:text-teal-300">{fmtH(data.today.billableSeconds)} h</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Non-billable</p>
          <p className="mt-2 text-2xl font-semibold text-slate-700 dark:text-slate-200">{fmtH(data.today.nonBillableSeconds)} h</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500">Active timers</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{data.activeTimers}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Weekly summary</h2>
        <div className="mt-4 flex h-40 items-end gap-1">
          {days.map((d) => {
            const v = data.week.byDay[d]?.total ?? 0;
            const max = Math.max(1, ...days.map((x) => data.week.byDay[x]?.total ?? 0));
            const h = Math.round((v / max) * 100);
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[2.5rem] rounded-t-md bg-teal-500/90 dark:bg-teal-400/80"
                  style={{ height: `${Math.max(8, h)}%` }}
                  title={`${d}: ${fmtH(v)} h`}
                />
                <span className="text-[10px] text-slate-500">{d.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent entries</h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {data.recentEntries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {e.projectName}
                    {e.taskName ? <span className="text-slate-500"> · {e.taskName}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.employeeName} · {e.workDate.slice(0, 10)}
                    {e.isRunning ? <span className="ml-2 text-teal-600">Running</span> : null}
                  </p>
                </div>
                <span className="tabular-nums text-slate-700 dark:text-slate-200">
                  {fmtH(e.durationSeconds)} h {e.billable ? <span className="text-teal-600">billable</span> : <span className="text-slate-400">non-bill.</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Project progress</h2>
          <ul className="mt-3 space-y-3">
            {data.projectProgress.map((p) => (
              <li key={p.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                  <span className="text-slate-500">{p.progressPercent}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-[width]"
                    style={{ width: `${Math.min(100, p.progressPercent)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmtH(p.loggedSeconds)} h logged
                  {p.budgetHours != null ? ` · budget ${p.budgetHours} h` : ""} · {p.customerName}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Team activity today</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {data.teamToday.map((t) => (
            <li
              key={t.employeeId}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
            >
              <span className="font-medium text-slate-800 dark:text-slate-100">{t.name}</span>
              <span className="ml-2 text-slate-500">{t.entries} entries</span>
            </li>
          ))}
          {!data.teamToday.length ? <li className="text-sm text-slate-500">No entries yet today.</li> : null}
        </ul>
      </section>
    </div>
  );
}
