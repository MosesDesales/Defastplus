"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Emp = {
  id: string;
  employeeNumber: string;
  displayName: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  isActive: boolean;
};

export function EmployeesClient() {
  const [rows, setRows] = useState<Emp[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    salaryStructureId: "",
  });
  const [structures, setStructures] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(async () => {
    const [eRes, sRes] = await Promise.all([
      fetch("/api/hr/employees", { credentials: "include" }),
      fetch("/api/hr/salary-structures", { credentials: "include" }),
    ]);
    const eData = await parseResponseJson<{ employees?: Emp[] }>(eRes, {});
    const sData = await parseResponseJson<{ structures?: Array<{ id: string; name: string }> }>(sRes, {});
    setRows(eData.employees ?? []);
    setStructures((sData.structures ?? []).map((x) => ({ id: x.id, name: x.name })));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/hr/employees", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        salaryStructureId: form.salaryStructureId || null,
      }),
    });
    if (!res.ok) {
      alert("Could not save.");
      return;
    }
    setOpen(false);
    setForm({ displayName: "", email: "", phone: "", department: "", designation: "", salaryStructureId: "" });
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this employee?")) return;
    const res = await fetch(`/api/hr/employees/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) alert("Could not delete.");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          {open ? "Close form" : "+ Add employee"}
        </button>
      </div>

      {open ? (
        <form onSubmit={createEmployee} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Name *</span>
              <input required value={form.displayName} onChange={(ev) => setForm((f) => ({ ...f, displayName: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Email</span>
              <input type="email" value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Phone</span>
              <input value={form.phone} onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Department</span>
              <input value={form.department} onChange={(ev) => setForm((f) => ({ ...f, department: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Designation</span>
              <input value={form.designation} onChange={(ev) => setForm((f) => ({ ...f, designation: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Salary structure</span>
              <select value={form.salaryStructureId} onChange={(ev) => setForm((f) => ({ ...f, salaryStructureId: ev.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="">— Later —</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
            Save employee
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Dept / Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">{r.employeeNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/hr/employees/${r.id}`} className="font-medium text-teal-700 hover:underline dark:text-teal-400">
                    {r.displayName}
                  </Link>
                  <div className="text-xs text-slate-500">{r.email ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {r.department ?? "—"} · {r.designation ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={r.isActive ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800" : "rounded-full bg-slate-200 px-2 py-0.5 text-xs"}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => void remove(r.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
