"use client";

import { useCallback, useEffect, useState } from "react";

type Reports = {
  completionByStatus: Record<string, number>;
  overdueTasks: Array<{ id: string; title: string; dueDate: string | null; assigneeName: string | null }>;
  employeeProductivity: Array<{
    employeeId: string | null;
    name: string;
    completed: number;
    open: number;
    billableHours: string;
  }>;
  billableHoursTotal: string;
};

export default function TasksReportsPage() {
  const [data, setData] = useState<Reports | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks/reports", { credentials: "include" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <p className="text-sm text-slate-500">Loading reports…</p>;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Reports</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.completionByStatus).map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs uppercase text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Billable hours (logged)</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">{data.billableHoursTotal} h</p>
        </div>
      </div>
      <section className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">Overdue tasks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.overdueTasks.length === 0 ? (
            <li className="text-slate-500">None</li>
          ) : (
            data.overdueTasks.map((t) => (
              <li key={t.id} className="text-red-700">
                {t.title} — {t.assigneeName ?? "Unassigned"}
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">Employee productivity</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2">Name</th>
              <th>Open</th>
              <th>Completed</th>
              <th>Billable h</th>
            </tr>
          </thead>
          <tbody>
            {data.employeeProductivity.map((e, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2">{e.name}</td>
                <td>{e.open}</td>
                <td>{e.completed}</td>
                <td>{e.billableHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
