"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  assignedEmployeeId: string | null;
  assigneeName: string | null;
  estimatedHours: number | null;
  billable: boolean;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
};

type Project = { id: string; name: string };
type Employee = { id: string; displayName: string };

const COLS: Task["status"][] = ["OPEN", "IN_PROGRESS", "COMPLETED"];

export function TimeTasksClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [estimate, setEstimate] = useState("");
  const [billable, setBillable] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    const [t, p, e] = await Promise.all([
      fetch("/api/time-tracking/tasks", { credentials: "include" }),
      fetch("/api/time-tracking/projects", { credentials: "include" }),
      fetch("/api/hr/employees", { credentials: "include" }),
    ]);
    if (!t.ok) {
      setErr("Could not load tasks");
      return;
    }
    const tj = await t.json();
    setTasks(tj.tasks ?? []);
    if (p.ok) {
      const pj = await p.json();
      setProjects((pj.projects ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    }
    if (e.ok) {
      const ej = await e.json();
      setEmployees((ej.employees ?? []).map((x: { id: string; displayName: string }) => ({ id: x.id, displayName: x.displayName })));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const m: Record<string, Task[]> = { OPEN: [], IN_PROGRESS: [], COMPLETED: [] };
    for (const t of tasks) {
      m[t.status]?.push(t);
    }
    return m;
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/time-tracking/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name,
        assignedEmployeeId: assignee || null,
        estimatedHours: estimate.trim() ? Number(estimate) : null,
        billable,
      }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Create failed");
      return;
    }
    setName("");
    setEstimate("");
    void load();
  }

  async function setStatus(id: string, status: Task["status"]) {
    const res = await fetch(`/api/time-tracking/tasks/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    void load();
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Tasks</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Kanban by status — drag is not required; move cards with the status control.</p>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <form onSubmit={addTask} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">New task</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            <option value="">Project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Assignee…</option>
            {employees.map((em) => (
              <option key={em.id} value={em.id}>
                {em.displayName}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.25"
            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            placeholder="Est. h"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
            Billable
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Add
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((col) => (
          <div key={col} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.replace(/_/g, " ")}</h2>
            <ul className="mt-3 space-y-2">
              {grouped[col]?.map((t) => (
                <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-950">
                  <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.projectName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.assigneeName ?? "Unassigned"} · {t.priority}
                    {t.billable ? " · billable" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COLS.filter((c) => c !== t.status).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] hover:border-teal-400 dark:border-slate-600"
                        onClick={() => void setStatus(t.id, c)}
                      >
                        → {c.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
