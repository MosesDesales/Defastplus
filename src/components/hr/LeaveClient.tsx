"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type LeaveType = {
  id: string;
  name: string;
  annualDays: number;
  isLossOfPay: boolean;
  isActive: boolean;
};

type Employee = { id: string; displayName: string };

type LeaveEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  date: string;
  days: number;
  notes: string | null;
};

export function LeaveClient() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<LeaveEntry[]>([]);

  const [typeForm, setTypeForm] = useState({ name: "", annualDays: "", isLossOfPay: false });
  const [entryForm, setEntryForm] = useState({ employeeId: "", leaveTypeId: "", date: "", days: "1", notes: "" });

  const load = useCallback(async () => {
    const [tRes, eRes, leRes] = await Promise.all([
      fetch("/api/hr/leave-types", { credentials: "include" }),
      fetch("/api/hr/employees", { credentials: "include" }),
      fetch("/api/hr/leave-entries", { credentials: "include" }),
    ]);
    const tData = await parseResponseJson<{ leaveTypes?: LeaveType[] }>(tRes, {});
    const eData = await parseResponseJson<{ employees?: Employee[] }>(eRes, {});
    const leData = await parseResponseJson<{ leaveEntries?: LeaveEntry[] }>(leRes, {});
    setTypes(tData.leaveTypes ?? []);
    setEmployees(eData.employees ?? []);
    setEntries(leData.leaveEntries ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEntryForm((f) => {
      if (f.employeeId && f.leaveTypeId) return f;
      return {
        ...f,
        employeeId: f.employeeId || employees[0]?.id || "",
        leaveTypeId: f.leaveTypeId || types[0]?.id || "",
      };
    });
  }, [employees, types]);

  async function createType(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/hr/leave-types", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: typeForm.name.trim(),
        annualDays: Number(typeForm.annualDays || 0),
        isLossOfPay: typeForm.isLossOfPay,
      }),
    });
    if (!res.ok) {
      alert("Could not save leave type.");
      return;
    }
    setTypeForm({ name: "", annualDays: "", isLossOfPay: false });
    void load();
  }

  async function removeType(id: string) {
    if (!confirm("Delete this leave type? Recorded entries under it will also be deleted.")) return;
    const res = await fetch(`/api/hr/leave-types/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) alert("Could not delete.");
    void load();
  }

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryForm.employeeId || !entryForm.leaveTypeId || !entryForm.date) {
      alert("Employee, leave type, and date are required.");
      return;
    }
    const res = await fetch("/api/hr/leave-entries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: entryForm.employeeId,
        leaveTypeId: entryForm.leaveTypeId,
        date: entryForm.date,
        days: Number(entryForm.days || 1),
        notes: entryForm.notes.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Could not save leave entry.");
      return;
    }
    setEntryForm((f) => ({ ...f, date: "", notes: "" }));
    void load();
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this leave entry?")) return;
    const res = await fetch(`/api/hr/leave-entries/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) alert("Could not delete.");
    void load();
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Leave types</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Annual quota per leave type. Mark a type as Loss of Pay so its days reduce Days Paid on the payslip.</p>
        <form onSubmit={createType} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="font-medium">Name</span>
            <input required value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Annual days</span>
            <input type="number" min="0" step="0.5" value={typeForm.annualDays} onChange={(e) => setTypeForm((f) => ({ ...f, annualDays: e.target.value }))} className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={typeForm.isLossOfPay} onChange={(e) => setTypeForm((f) => ({ ...f, isLossOfPay: e.target.checked }))} />
            <span className="font-medium">Loss of Pay</span>
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Add leave type
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Annual days</th>
                <th className="px-4 py-3">Loss of Pay</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3">{t.annualDays}</td>
                  <td className="px-4 py-3">{t.isLossOfPay ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void removeType(t.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Record leave</h2>
        <form onSubmit={createEntry} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="font-medium">Employee</span>
            <select value={entryForm.employeeId} onChange={(e) => setEntryForm((f) => ({ ...f, employeeId: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Leave type</span>
            <select value={entryForm.leaveTypeId} onChange={(e) => setEntryForm((f) => ({ ...f, leaveTypeId: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Date</span>
            <input type="date" required value={entryForm.date} onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Days</span>
            <input type="number" min="0.5" step="0.5" value={entryForm.days} onChange={(e) => setEntryForm((f) => ({ ...f, days: e.target.value }))} className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Notes</span>
            <input value={entryForm.notes} onChange={(e) => setEntryForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Record leave
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent leave entries</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Leave type</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((en) => (
                <tr key={en.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono">{en.date}</td>
                  <td className="px-4 py-3">{en.employeeName}</td>
                  <td className="px-4 py-3">{en.leaveTypeName}</td>
                  <td className="px-4 py-3">{en.days}</td>
                  <td className="px-4 py-3 text-slate-500">{en.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void removeEntry(en.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
