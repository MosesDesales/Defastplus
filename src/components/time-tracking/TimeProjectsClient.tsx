"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = { id: string; displayName: string };
type Employee = { id: string; displayName: string };
type Project = {
  id: string;
  name: string;
  customerName: string;
  hourlyRate: number;
  billingType: string;
  status: string;
  progressPercent: number;
  budgetHours: number | null;
};

const BILLING = ["FIXED_COST", "PROJECT_HOURS", "STAFF_HOURS"] as const;

export function TimeProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [billingType, setBillingType] = useState<(typeof BILLING)[number]>("PROJECT_HOURS");
  const [budgetHours, setBudgetHours] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setErr(null);
    const [pr, cu, em] = await Promise.all([
      fetch("/api/time-tracking/projects", { credentials: "include" }),
      fetch("/api/customers", { credentials: "include" }),
      fetch("/api/hr/employees", { credentials: "include" }),
    ]);
    if (!pr.ok) {
      setErr("Could not load projects");
      return;
    }
    const pj = await pr.json();
    setProjects(pj.projects ?? []);
    if (cu.ok) {
      const cj = await cu.json();
      setCustomers((cj.customers ?? []).map((c: { id: string; displayName: string }) => ({ id: c.id, displayName: c.displayName })));
    }
    if (em.ok) {
      const ej = await em.json();
      setEmployees((ej.employees ?? []).map((e: { id: string; displayName: string }) => ({ id: e.id, displayName: e.displayName })));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/time-tracking/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        customerId,
        hourlyRate: Number(hourlyRate) || 0,
        billingType,
        budgetHours: budgetHours.trim() ? Number(budgetHours) : null,
        memberEmployeeIds: memberIds,
      }),
    });
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({})))?.error ?? "Create failed");
      return;
    }
    setName("");
    setBudgetHours("");
    setMemberIds([]);
    setMsg("Project created.");
    void load();
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Time tracking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Projects</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Billable projects linked to customers, budgets, and team members.</p>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-teal-700 dark:text-teal-300">{msg}</p> : null}

      <form onSubmit={createProject} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">New project</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Customer</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Hourly rate</span>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Billing type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as (typeof BILLING)[number])}
            >
              {BILLING.map((b) => (
                <option key={b} value={b}>
                  {b.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600 dark:text-slate-400">Budget hours (optional)</span>
            <input
              type="number"
              step="0.25"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={budgetHours}
              onChange={(e) => setBudgetHours(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-500">Assign employees</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {employees.map((emp) => (
              <label key={emp.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600">
                <input type="checkbox" checked={memberIds.includes(emp.id)} onChange={() => toggleMember(emp.id)} />
                {emp.displayName}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Create project
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Billing</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{p.name}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.customerName}</td>
                <td className="px-4 py-2 tabular-nums">{p.hourlyRate}</td>
                <td className="px-4 py-2 text-slate-600">{p.billingType.replace(/_/g, " ")}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 max-w-[120px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full bg-teal-500" style={{ width: `${p.progressPercent}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{p.progressPercent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!projects.length ? <p className="p-4 text-sm text-slate-500">No projects yet.</p> : null}
      </section>
    </div>
  );
}
