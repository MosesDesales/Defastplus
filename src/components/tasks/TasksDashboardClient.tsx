"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-badges";
import type { WorkTaskStatus } from "@prisma/client";

type TaskRow = {
  id: string;
  title: string;
  status: WorkTaskStatus;
  priority: string;
  dueDate: string | null;
  assigneeName: string | null;
  projectName: string | null;
  progressPercent: number;
  overdue: boolean;
};

type DashboardPayload = {
  summary: { total: number; pending: number; inProgress: number; completed: number; overdue: number };
  todayTasks: TaskRow[];
  upcomingDeadlines: TaskRow[];
  recentlyUpdated: TaskRow[];
  teamActivity: Array<{ employeeId: string; name: string; updates: number }>;
};

export function TasksDashboardClient() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/tasks/dashboard", { credentials: "include" });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not load dashboard");
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  const cards = [
    { label: "Total Tasks", value: data.summary.total, color: "text-slate-900 dark:text-white" },
    { label: "Pending", value: data.summary.pending, color: "text-slate-700" },
    { label: "In Progress", value: data.summary.inProgress, color: "text-blue-700 dark:text-blue-300" },
    { label: "Completed", value: data.summary.completed, color: "text-emerald-700 dark:text-emerald-300" },
    { label: "Overdue", value: data.summary.overdue, color: "text-red-700 dark:text-red-300" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Overview of team workload, deadlines, and recent activity.
          </p>
        </div>
        <Link
          href="/tasks/all"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          + New Task
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase text-slate-500">{c.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TaskWidget title="Today's tasks" tasks={data.todayTasks} empty="Nothing scheduled for today." />
        <TaskWidget title="Upcoming deadlines" tasks={data.upcomingDeadlines} empty="No deadlines this week." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Team activity (7 days)</h2>
          <ul className="mt-3 space-y-2">
            {data.teamActivity.length === 0 ? (
              <li className="text-sm text-slate-500">No recent updates.</li>
            ) : (
              data.teamActivity.map((t) => (
                <li key={t.employeeId} className="flex justify-between text-sm">
                  <span>{t.name}</span>
                  <span className="text-slate-500">{t.updates} updates</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <TaskWidget title="Recently updated" tasks={data.recentlyUpdated} empty="No recent changes." />
      </div>
    </div>
  );
}

function TaskWidget({ title, tasks, empty }: { title: string; tasks: TaskRow[]; empty: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.length === 0 ? (
          <li className="py-4 text-sm text-slate-500">{empty}</li>
        ) : (
          tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-3">
              <Link href={`/tasks/${t.id}`} className="flex-1 font-medium text-violet-700 hover:underline dark:text-violet-300">
                {t.title}
              </Link>
              <TaskStatusBadge status={t.status} />
              <TaskPriorityBadge priority={t.priority} />
              {t.overdue ? <span className="text-xs font-medium text-red-600">Overdue</span> : null}
              <span className="w-full text-xs text-slate-500">
                {t.assigneeName ?? "Unassigned"}
                {t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
