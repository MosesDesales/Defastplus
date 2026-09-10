"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-badges";
import type { WorkTaskPriority, WorkTaskStatus } from "@prisma/client";

type Props = { taskId: string };

export function TaskDetailClient({ taskId }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [employees, setEmployees] = useState<Array<{ id: string; displayName: string }>>([]);
  const [timerEmployeeId, setTimerEmployeeId] = useState("");
  const [runningEntryId, setRunningEntryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" });
    if (!res.ok) {
      setErr("Task not found");
      return;
    }
    setData(await res.json());
  }, [taskId]);

  useEffect(() => {
    void load();
    void fetch("/api/hr/employees", { credentials: "include" }).then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        const list = (j.employees ?? []).map((e: { id: string; displayName: string }) => ({
          id: e.id,
          displayName: e.displayName,
        }));
        setEmployees(list);
        if (list[0]) setTimerEmployeeId(list[0].id);
      }
    });
  }, [load]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  const task = data.task as {
    id: string;
    title: string;
    description: string | null;
    status: WorkTaskStatus;
    priority: WorkTaskPriority;
    assigneeName: string | null;
    projectName: string | null;
    customerName: string | null;
    vendorName: string | null;
    dueDate: string | null;
    estimatedHours: number | null;
    actualSeconds: number;
    progressPercent: number;
    billable: boolean;
    tags: string[];
    overdue: boolean;
  };
  const subtasks = (data.subtasks ?? []) as Array<{ id: string; title: string; status: string }>;
  const comments = (data.comments ?? []) as Array<{ id: string; body: string; createdAt: string; user: { name: string } }>;
  const timeLogs = (data.timeLogs ?? []) as Array<{
    id: string;
    durationSeconds: number;
    billable: boolean;
    employeeName: string;
    isRunning: boolean;
  }>;
  const activity = (data.activity ?? []) as Array<{ action: string; createdAt: string }>;

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/tasks/comment", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, body: comment }),
    });
    setComment("");
    void load();
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: subtaskTitle }),
    });
    setSubtaskTitle("");
    void load();
  }

  async function toggleSubtask(id: string, markComplete: boolean) {
    await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtaskId: id, status: markComplete ? "COMPLETED" : "OPEN" }),
    });
    void load();
  }

  async function startTimer() {
    const res = await fetch("/api/tasks/timer/start", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: timerEmployeeId, workTaskId: taskId }),
    });
    if (res.ok) {
      const j = await res.json();
      setRunningEntryId(j.id);
      void load();
    }
  }

  async function stopTimer() {
    await fetch("/api/tasks/timer/stop", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: runningEntryId ?? undefined }),
    });
    setRunningEntryId(null);
    void load();
  }

  const running = timeLogs.some((l) => l.isRunning);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/tasks/all" className="text-sm text-violet-600 hover:underline">
          ← All tasks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{task.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
          {task.overdue ? <span className="text-sm font-medium text-red-600">Overdue</span> : null}
          {task.billable ? <span className="text-xs rounded-full bg-teal-100 px-2 py-0.5 text-teal-800">Billable</span> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{task.description || "—"}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Assignee</dt>
                <dd>{task.assigneeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Project</dt>
                <dd>{task.projectName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Customer</dt>
                <dd>{task.customerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Vendor</dt>
                <dd>{task.vendorName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due</dt>
                <dd>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Estimated</dt>
                <dd>{task.estimatedHours != null ? `${task.estimatedHours} h` : "—"}</dd>
              </div>
            </dl>
            {task.tags.length ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4">
              <p className="text-xs text-slate-500">Progress {task.progressPercent}%</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full bg-violet-500" style={{ width: `${task.progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Subtasks</h2>
            <ul className="mt-3 space-y-2">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.status === "COMPLETED"}
                    onChange={() => void toggleSubtask(s.id, s.status !== "COMPLETED")}
                  />
                  <span className={s.status === "COMPLETED" ? "line-through text-slate-400" : ""}>{s.title}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={addSubtask} className="mt-3 flex gap-2">
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Add subtask…"
                className="flex-1 rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">
                Add
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Comments</h2>
            <ul className="mt-3 space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{c.user.name}</span>
                  <span className="text-slate-400"> · {new Date(c.createdAt).toLocaleString()}</span>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{c.body}</p>
                </li>
              ))}
            </ul>
            <form onSubmit={postComment} className="mt-3 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <button type="submit" className="rounded-lg border px-3 py-2 text-sm">
                Post
              </button>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Time tracking</h2>
            <p className="mt-1 text-xs text-slate-500">
              Logged {(task.actualSeconds / 3600).toFixed(2)} h
              {task.billable ? " (billable)" : ""}
            </p>
            <select
              value={timerEmployeeId}
              onChange={(e) => setTimerEmployeeId(e.target.value)}
              className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
            {running ? (
              <button type="button" onClick={() => void stopTimer()} className="mt-2 w-full rounded-lg bg-red-600 py-2 text-sm text-white">
                Stop timer
              </button>
            ) : (
              <button type="button" onClick={() => void startTimer()} className="mt-2 w-full rounded-lg bg-teal-600 py-2 text-sm text-white">
                Start timer
              </button>
            )}
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {timeLogs.map((l) => (
                <li key={l.id}>
                  {l.employeeName}: {(l.durationSeconds / 3600).toFixed(2)} h
                  {l.isRunning ? " (running)" : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Activity</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {activity.length === 0 ? <li>No activity yet.</li> : null}
              {activity.map((a, i) => (
                <li key={i}>
                  {a.action} · {new Date(a.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
