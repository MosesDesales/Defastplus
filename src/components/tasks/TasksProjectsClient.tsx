"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProjectRow = {
  id: string;
  name: string;
  customerName: string;
  progressPercent: number;
  status: string;
  openTasks: number;
  completedTasks: number;
};

export function TasksProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const [pRes, tRes] = await Promise.all([
      fetch("/api/time-tracking/projects", { credentials: "include" }),
      fetch("/api/tasks", { credentials: "include" }),
    ]);
    if (!pRes.ok) {
      setErr("Could not load projects");
      return;
    }
    const pj = await pRes.json();
    const tasks = tRes.ok ? ((await tRes.json()).tasks ?? []) : [];
    const byProject = new Map<string, { open: number; done: number }>();
    for (const t of tasks) {
      if (!t.timeProjectId && !t.projectName) continue;
      const pid = t.timeProjectId ?? "";
      if (!pid) continue;
      const cur = byProject.get(pid) ?? { open: 0, done: 0 };
      if (t.status === "COMPLETED") cur.done += 1;
      else if (t.status !== "CANCELLED") cur.open += 1;
      byProject.set(pid, cur);
    }
    setProjects(
      (pj.projects ?? []).map((p: { id: string; name: string; customer?: { displayName: string }; progressPercent: number; status: string }) => {
        const agg = byProject.get(p.id) ?? { open: 0, done: 0 };
        return {
          id: p.id,
          name: p.name,
          customerName: p.customer?.displayName ?? "—",
          progressPercent: p.progressPercent,
          status: p.status,
          openTasks: agg.open,
          completedTasks: agg.done,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Projects</h1>
        <p className="mt-2 text-sm text-slate-600">
          Time-tracking projects linked to work tasks. Progress updates when tasks are completed.
        </p>
      </header>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/tasks/all?projectId=${p.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white">{p.name}</h2>
            <p className="text-sm text-slate-500">{p.customerName}</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-600">
              <span>{p.openTasks} open tasks</span>
              <span>{p.completedTasks} completed</span>
              <span>{p.progressPercent}% project progress</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-violet-500" style={{ width: `${p.progressPercent}%` }} />
            </div>
          </Link>
        ))}
      </div>
      {projects.length === 0 ? <p className="text-sm text-slate-500">No projects yet. Create one under Time Tracking.</p> : null}
    </div>
  );
}
