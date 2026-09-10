"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskPriorityBadge } from "@/components/tasks/task-badges";
import type { TaskDto } from "@/components/tasks/TasksListClient";
import type { WorkTaskStatus } from "@prisma/client";

const COLS: { status: WorkTaskStatus; label: string }[] = [
  { status: "OPEN", label: "Open" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "WAITING_REVIEW", label: "Review" },
  { status: "COMPLETED", label: "Completed" },
];

export function TasksKanbanClient() {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/tasks", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load board");
      return;
    }
    const j = await res.json();
    setTasks((j.tasks ?? []).filter((t: TaskDto) => t.status !== "CANCELLED"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const m: Record<string, TaskDto[]> = {};
    for (const c of COLS) m[c.status] = [];
    for (const t of tasks) {
      if (m[t.status]) m[t.status]!.push(t);
    }
    return m;
  }, [tasks]);

  async function moveTask(taskId: string, status: WorkTaskStatus) {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Kanban board</h1>
        <p className="mt-2 text-sm text-slate-600">Drag cards between columns to update status.</p>
      </header>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((col) => (
          <div
            key={col.status}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) void moveTask(dragId, col.status);
              setDragId(null);
            }}
          >
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {col.label}
              <span className="ml-2 text-slate-400">({grouped[col.status]?.length ?? 0})</span>
            </h2>
            <div className="space-y-2">
              {(grouped[col.status] ?? []).map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm active:cursor-grabbing dark:bg-slate-900 ${
                    t.overdue ? "border-red-300 dark:border-red-800" : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Link href={`/tasks/${t.id}`} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
                    {t.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <TaskPriorityBadge priority={t.priority} />
                    {t.overdue ? <span className="text-xs text-red-600">Overdue</span> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {t.assigneeName ?? "Unassigned"}
                    {t.dueDate ? ` · ${new Date(t.dueDate).toLocaleDateString()}` : ""}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full bg-violet-500" style={{ width: `${t.progressPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
