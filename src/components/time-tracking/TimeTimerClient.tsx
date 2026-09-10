"use client";

import { useCallback, useEffect, useState } from "react";
import { liveDurationSeconds } from "@/lib/time-tracking/timer-helpers";

type Employee = { id: string; displayName: string };
type Project = { id: string; name: string };
type Task = { id: string; name: string; projectId: string };

const LS = "dab_time_timer_v1";

type Active = {
  id: string;
  employeeId: string;
  durationSeconds: number;
  isRunning: boolean;
  startedAt: string | null;
  projectId: string | null;
  taskId: string | null;
  projectName: string | null;
  taskName: string | null;
};

export function TimeTimerClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState<Active | null>(null);
  const [pausedEntryId, setPausedEntryId] = useState<string | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [mDate, setMDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mHours, setMHours] = useState("1");
  const [mBillable, setMBillable] = useState(true);
  const [mNotes, setMNotes] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshTimer = useCallback(async () => {
    if (!employeeId) return;
    const res = await fetch(`/api/time-tracking/timer?employeeId=${encodeURIComponent(employeeId)}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const j = await res.json();
    setActive(j.active);
    if (j.active?.id) {
      setPausedSeconds(null);
      try {
        localStorage.setItem(LS, JSON.stringify({ entryId: j.active.id, employeeId }));
      } catch {
        /* ignore */
      }
    }
  }, [employeeId]);

  const loadMeta = useCallback(async () => {
    const [e, p, t] = await Promise.all([
      fetch("/api/hr/employees", { credentials: "include" }),
      fetch("/api/time-tracking/projects", { credentials: "include" }),
      fetch("/api/time-tracking/tasks", { credentials: "include" }),
    ]);
    if (e.ok) {
      const ej = await e.json();
      const list = (ej.employees ?? []).map((x: { id: string; displayName: string }) => ({ id: x.id, displayName: x.displayName }));
      setEmployees(list);
      if (!employeeId && list[0]) setEmployeeId(list[0].id);
    }
    if (p.ok) {
      const pj = await p.json();
      setProjects((pj.projects ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    }
    if (t.ok) {
      const tj = await t.json();
      setTasks((tj.tasks ?? []).map((x: { id: string; name: string; projectId: string }) => ({ id: x.id, name: x.name, projectId: x.projectId })));
    }
  }, [employeeId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void refreshTimer();
    const id = setInterval(() => void refreshTimer(), 2000);
    return () => clearInterval(id);
  }, [refreshTimer]);

  useEffect(() => {
    if (!active?.id) return;
    const id = setInterval(async () => {
      await fetch("/api/time-tracking/timer/heartbeat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: active.id }),
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [active?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (!raw) return;
      const o = JSON.parse(raw) as { entryId?: string; employeeId?: string };
      if (o.employeeId && !employeeId) setEmployeeId(o.employeeId);
      if (o.entryId) setPausedEntryId(o.entryId);
    } catch {
      /* ignore */
    }
  }, [employeeId]);

  async function start() {
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/time-tracking/timer/start", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        projectId: projectId || null,
        taskId: taskId || null,
        notes: notes || null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error ?? "Could not start");
      return;
    }
    setMsg("Timer started.");
    void refreshTimer();
  }

  async function pause() {
    const res = await fetch("/api/time-tracking/timer/pause", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const j = (await res.json()) as { id?: string; durationSeconds?: number };
      if (j.id) setPausedEntryId(j.id);
      if (typeof j.durationSeconds === "number") setPausedSeconds(j.durationSeconds);
    }
    void refreshTimer();
  }

  async function resume() {
    const id = pausedEntryId ?? active?.id;
    if (!id) return;
    const res = await fetch("/api/time-tracking/timer/resume", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: id }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not resume");
      return;
    }
    void refreshTimer();
  }

  async function stop() {
    const res = await fetch("/api/time-tracking/timer/stop", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: active?.id ?? pausedEntryId ?? undefined }),
    });
    if (res.ok) {
      try {
        localStorage.removeItem(LS);
      } catch {
        /* ignore */
      }
      setPausedEntryId(null);
      setPausedSeconds(null);
    }
    void refreshTimer();
  }

  async function manual(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/time-tracking/entries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        workDate: mDate,
        projectId: projectId || null,
        taskId: taskId || null,
        hours: Number(mHours),
        billable: mBillable,
        notes: mNotes || null,
      }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not add entry");
      return;
    }
    setMsg("Manual entry saved.");
    setMNotes("");
  }

  const filteredTasks = tasks.filter((t) => !projectId || t.projectId === projectId);
  void tick;
  const displaySeconds = active
    ? liveDurationSeconds({
        durationSeconds: active.durationSeconds,
        isRunning: active.isRunning,
        startedAt: active.startedAt ? new Date(active.startedAt) : null,
      })
    : pausedSeconds ?? 0;
  const hh = String(Math.floor(displaySeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(displaySeconds % 60).padStart(2, "0");

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Timer</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          One active timer per organization. Pauses commit elapsed time; heartbeat auto-saves every minute while running.
        </p>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-teal-700 dark:text-teal-300">{msg}</p> : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
          <p className="text-xs font-medium uppercase text-slate-500">Live</p>
          <p className="mt-4 text-center font-mono text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {hh}:{mm}:{ss}
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            {active ? (
              <>
                {active.projectName ?? "No project"} {active.taskName ? `· ${active.taskName}` : ""}
              </>
            ) : pausedEntryId ? (
              <span>Paused — resume to continue or stop to finalize.</span>
            ) : (
              "No running timer"
            )}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-600 dark:text-slate-400">Employee</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-600 dark:text-slate-400">Project</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId("");
                }}
              >
                <option value="">Optional</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-600 dark:text-slate-400">Task</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">Optional</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-600 dark:text-slate-400">Notes</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!active}
              onClick={() => void start()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
            >
              Start
            </button>
            <button
              type="button"
              disabled={!active}
              onClick={() => void pause()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:border-teal-500 disabled:opacity-40 dark:border-slate-600"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => void resume()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:border-teal-500 dark:border-slate-600"
            >
              Resume
            </button>
            <button
              type="button"
              disabled={!active && !pausedEntryId}
              onClick={() => void stop()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
            >
              Stop
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Manual time entry</h2>
          <form onSubmit={manual} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-600">Date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Hours</span>
              <input
                type="number"
                step="0.25"
                min={0.01}
                max={24}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={mHours}
                onChange={(e) => setMHours(e.target.value)}
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={mBillable} onChange={(e) => setMBillable(e.target.checked)} />
              Billable
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-600">Notes</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
              />
            </label>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2">
              Log hours
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Uses the same project and task picks as the timer (left).</p>
        </section>
      </div>
    </div>
  );
}
