"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import { SalaryComponentEditor, emptyComponentRow, type SalaryComponentRow } from "@/components/hr/SalaryComponentEditor";

type ApiComponent = {
  id: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amountType: "FLAT" | "PERCENT_OF_BASIC";
  amount: number;
  percentOfBasic: number | null;
};

type Employee = {
  employeeNumber: string;
  displayName: string;
  salaryStructureId: string | null;
  salaryStructure: { id: string; name: string; isTemplate: boolean; components: ApiComponent[] } | null;
  payslipHistory: Array<{ yearMonth: string; status: string; gross: number; netPay: number }>;
};

type Template = { id: string; name: string; components: ApiComponent[] };

function rowsFromComponents(components: ApiComponent[]): SalaryComponentRow[] {
  return components.map((c) => ({
    name: c.name,
    kind: c.kind,
    amountType: c.amountType,
    amount: String(c.amount),
    percentOfBasic: c.percentOfBasic != null ? String(c.percentOfBasic) : "",
  }));
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Employee | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pickedTemplateId, setPickedTemplateId] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [customRows, setCustomRows] = useState<SalaryComponentRow[]>([emptyComponentRow()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [eRes, tRes] = await Promise.all([
      fetch(`/api/hr/employees/${id}`, { credentials: "include" }),
      fetch("/api/hr/salary-structures", { credentials: "include" }),
    ]);
    const eData = await parseResponseJson<{ employee?: Employee }>(eRes, {});
    const tData = await parseResponseJson<{ structures?: Template[] }>(tRes, {});
    setData(eData.employee ?? null);
    setTemplates(tData.structures ?? []);
    setPickedTemplateId(eData.employee?.salaryStructure?.isTemplate ? eData.employee.salaryStructure.id : "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function startCustomize() {
    const current = data?.salaryStructure;
    setCustomRows(current && current.components.length ? rowsFromComponents(current.components) : [emptyComponentRow()]);
    setCustomizing(true);
  }

  async function saveTemplateChoice() {
    if (!pickedTemplateId) {
      alert("Pick a template first.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${id}/salary`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "template", salaryStructureId: pickedTemplateId }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Could not save.");
      return;
    }
    void load();
  }

  async function saveCustom(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${id}/salary`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "custom",
        components: customRows.map((r, i) => ({
          name: r.name.trim(),
          kind: r.kind,
          amountType: r.amountType,
          amount: r.amountType === "FLAT" ? Number(r.amount || 0) : 0,
          percentOfBasic: r.amountType === "PERCENT_OF_BASIC" ? Number(r.percentOfBasic || 0) : null,
          sortOrder: i,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Could not save.");
      return;
    }
    setCustomizing(false);
    void load();
  }

  if (!data) return <p className="text-slate-500">Loading…</p>;

  const structure = data.salaryStructure;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/hr/employees" className="text-xs font-semibold uppercase text-teal-600 hover:underline dark:text-teal-400">
        ← Employees
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {data.displayName}{" "}
          <span className="font-mono text-lg text-slate-500">{data.employeeNumber}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Salary setup, history & payslips</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Salary</h2>

        {customizing ? (
          <form onSubmit={saveCustom} className="mt-4 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Custom salary for {data.displayName} only — doesn&apos;t affect the shared template.</p>
            <SalaryComponentEditor rows={customRows} onChange={setCustomRows} />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save custom salary"}
              </button>
              <button type="button" onClick={() => setCustomizing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            {structure ? (
              <div>
                <p className="text-sm">
                  <span className="font-medium">{structure.isTemplate ? `Using template: ${structure.name}` : "Custom salary for this employee"}</span>
                </p>
                <ul className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {structure.components.map((c) => (
                    <li key={c.id}>
                      {c.name} — {c.kind === "EARNING" ? "Earning" : "Deduction"},{" "}
                      {c.amountType === "FLAT" ? c.amount.toFixed(2) : `${c.percentOfBasic ?? 0}% of Basic`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No salary assigned yet.</p>
            )}

            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <label className="text-sm">
                <span className="font-medium">Use company template</span>
                <select value={pickedTemplateId} onChange={(e) => setPickedTemplateId(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <option value="">— Pick a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={saving} onClick={() => void saveTemplateChoice()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Assign template
              </button>
              <button type="button" onClick={startCustomize} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {structure && !structure.isTemplate ? "Edit custom salary" : "Customize for this employee"}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Run status</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {data.payslipHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No payslips yet.
                </td>
              </tr>
            ) : (
              data.payslipHistory.map((p, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 tabular-nums">{p.yearMonth}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.gross.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.netPay.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
