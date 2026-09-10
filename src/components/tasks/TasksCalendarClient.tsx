"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskDto } from "@/components/tasks/TasksListClient";

export function TasksCalendarClient() {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks", { credentials: "include" });
    if (res.ok) {
      const j = await res.json();
      setTasks(j.tasks ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { year, month, cells } = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, key: `pad-${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(y, m, d), key: `${y}-${m}-${d}` });
    }
    return { year: y, month: m, cells };
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = t.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const monthLabel = new Date(year, month).toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Calendar</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setAnchor(new Date(year, month - 1, 1))}
          >
            ←
          </button>
          <span className="px-2 py-1.5 text-sm font-medium">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setAnchor(new Date(year, month + 1, 1))}
          >
            →
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.date) return <div key={cell.key} className="min-h-[88px]" />;
          const key = cell.date.toISOString().slice(0, 10);
          const dayTasks = byDay.get(key) ?? [];
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={cell.key}
              className={`min-h-[88px] rounded-lg border p-1 text-left dark:border-slate-700 ${
                isToday ? "border-violet-400 bg-violet-50/50 dark:bg-violet-950/30" : "border-slate-200 bg-white dark:bg-slate-900"
              }`}
            >
              <span className="text-xs font-medium text-slate-600">{cell.date.getDate()}</span>
              <ul className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.id}`}
                      className={`block truncate text-[10px] hover:underline ${t.overdue ? "text-red-600" : "text-violet-700 dark:text-violet-300"}`}
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
                {dayTasks.length > 3 ? (
                  <li className="text-[10px] text-slate-400">+{dayTasks.length - 3} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
