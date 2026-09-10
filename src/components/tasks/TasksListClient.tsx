"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-badges";
import type { WorkTaskPriority, WorkTaskStatus } from "@prisma/client";

export type TaskDto = {
  id: string;
  title: string;
  assigneeName: string | null;
  timeProjectId: string | null;
  projectName: string | null;
  dueDate: string | null;
  priority: WorkTaskPriority;
  status: WorkTaskStatus;
  progressPercent: number;
  overdue: boolean;
  customerName: string | null;
  tags: string[];
};

type Props = {
  title: string;
  description: string;
  defaultQuery?: Record<string, string>;
  showCreate?: boolean;
};

type Employee = { id: string; displayName: string };
type Project = { id: string; name: string };
type Customer = { id: string; displayName: string };
type Vendor = { id: string; displayName: string };

const STATUSES: WorkTaskStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_REVIEW", "COMPLETED", "CANCELLED"];
const PRIORITIES: WorkTaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TasksListClient({ title, description, defaultQuery = {}, showCreate = true }: Props) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(defaultQuery.status ?? "");
  const [assignee, setAssignee] = useState(defaultQuery.assignee ?? "");
  const [projectId, setProjectId] = useState(defaultQuery.projectId ?? "");
  const [priority, setPriority] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formProject, setFormProject] = useState("");
  const [formCustomer, setFormCustomer] = useState("");
  const [formVendor, setFormVendor] = useState("");
  const [formPriority, setFormPriority] = useState<WorkTaskPriority>("MEDIUM");
  const [formStatus, setFormStatus] = useState<WorkTaskStatus>("OPEN");
  const [formDue, setFormDue] = useState("");
  const [formEstimate, setFormEstimate] = useState("");
  const [formBillable, setFormBillable] = useState(false);
  const [formTags, setFormTags] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ ...defaultQuery });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (assignee) p.set("assignee", assignee);
    if (projectId) p.set("projectId", projectId);
    if (priority) p.set("priority", priority);
    return p.toString();
  }, [defaultQuery, q, status, assignee, projectId, priority]);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/tasks?${queryString}`, { credentials: "include" });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not load tasks");
      return;
    }
    const j = await res.json();
    setTasks(j.tasks ?? []);
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const [e, p, c, v] = await Promise.all([
        fetch("/api/hr/employees", { credentials: "include" }),
        fetch("/api/time-tracking/projects", { credentials: "include" }),
        fetch("/api/customers", { credentials: "include" }),
        fetch("/api/purchases/vendors", { credentials: "include" }),
      ]);
      if (e.ok) {
        const ej = await e.json();
        setEmployees((ej.employees ?? []).map((x: Employee) => ({ id: x.id, displayName: x.displayName })));
      }
      if (p.ok) {
        const pj = await p.json();
        setProjects((pj.projects ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      }
      if (c.ok) {
        const cj = await c.json();
        setCustomers((cj.customers ?? []).map((x: Customer) => ({ id: x.id, displayName: x.displayName })));
      }
      if (v.ok) {
        const vj = await v.json();
        setVendors((vj.vendors ?? []).map((x: Vendor) => ({ id: x.id, displayName: x.displayName })));
      }
    })();
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle,
        description: formDesc || null,
        assignedEmployeeId: formAssignee || null,
        timeProjectId: formProject || null,
        customerId: formCustomer || null,
        vendorId: formVendor || null,
        priority: formPriority,
        status: formStatus,
        dueDate: formDue || null,
        estimatedHours: formEstimate.trim() ? Number(formEstimate) : null,
        billable: formBillable,
        tags: formTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Could not create task");
      return;
    }
    setShowForm(false);
    setFormTitle("");
    void load();
  }

  async function markComplete(id: string) {
    await fetch(`/api/tasks/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    void load();
  }

  async function removeTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    void load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-600">Tasks</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {showCreate ? (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            + New Task
          </button>
        ) : null}
      </header>

      {showForm ? (
        <form onSubmit={createTask} className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Title *</span>
              <input
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Description</span>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Assigned to</span>
              <select
                value={formAssignee}
                onChange={(e) => setFormAssignee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">—</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Project</span>
              <select
                value={formProject}
                onChange={(e) => setFormProject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Customer</span>
              <select
                value={formCustomer}
                onChange={(e) => setFormCustomer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Vendor</span>
              <select
                value={formVendor}
                onChange={(e) => setFormVendor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">—</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Priority</span>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as WorkTaskPriority)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Due date</span>
              <input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Estimated hours</span>
              <input
                type="number"
                step="0.25"
                min="0"
                value={formEstimate}
                onChange={(e) => setFormEstimate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={formBillable} onChange={(e) => setFormBillable(e.target.checked)} />
              <span className="text-sm">Billable</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Tags (comma-separated)</span>
              <input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
          </div>
          <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">
            Save task
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        {!defaultQuery.status ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
        {!defaultQuery.assignee ? (
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">All assignees</option>
            <option value="mine">My tasks</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.displayName}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm">
          Apply
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No tasks found.
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className={t.overdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${t.id}`} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
                      {t.title}
                    </Link>
                    {t.overdue ? <span className="ml-2 text-xs text-red-600">Overdue</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.assigneeName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.projectName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-full bg-violet-500" style={{ width: `${t.progressPercent}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{t.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/tasks/${t.id}`} className="text-violet-600 hover:underline">
                        View
                      </Link>
                      {t.status !== "COMPLETED" ? (
                        <button type="button" onClick={() => void markComplete(t.id)} className="text-emerald-600 hover:underline">
                          Complete
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void removeTask(t.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
