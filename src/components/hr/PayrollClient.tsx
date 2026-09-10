"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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

type Template = { id: string; name: string; components: ApiComponent[] };

type Run = { id: string; yearMonth: string; status: string; payslipCount: number };

type PayslipRow = {
  id: string;
  employeeName: string;
  employeeNumber: string;
  hasEmail: boolean;
  gross: number;
  netPay: number;
};

function rowsFromComponents(components: ApiComponent[]): SalaryComponentRow[] {
  return components.map((c) => ({
    name: c.name,
    kind: c.kind,
    amountType: c.amountType,
    amount: String(c.amount),
    percentOfBasic: c.percentOfBasic != null ? String(c.percentOfBasic) : "",
  }));
}

function defaultRows(): SalaryComponentRow[] {
  return [
    { name: "Basic", kind: "EARNING", amountType: "FLAT", amount: "50000", percentOfBasic: "" },
    { name: "HRA", kind: "EARNING", amountType: "PERCENT_OF_BASIC", amount: "0", percentOfBasic: "40" },
    { name: "PF", kind: "DEDUCTION", amountType: "PERCENT_OF_BASIC", amount: "0", percentOfBasic: "12" },
  ];
}

export function PayrollClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorRows, setEditorRows] = useState<SalaryComponentRow[]>(defaultRows());

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [payslipsByRun, setPayslipsByRun] = useState<Record<string, PayslipRow[]>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/hr/payroll", { credentials: "include" });
    const data = await parseResponseJson<{ runs?: Run[] }>(res, {});
    setRuns(data.runs ?? []);
  }, []);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/hr/salary-structures", { credentials: "include" });
    const data = await parseResponseJson<{ structures?: Template[] }>(res, {});
    setTemplates(data.structures ?? []);
  }, []);

  useEffect(() => {
    void loadRuns();
    void loadTemplates();
  }, [loadRuns, loadTemplates]);

  function startNewTemplate() {
    setEditingId("new");
    setEditorName("");
    setEditorRows(defaultRows());
  }

  function startEditTemplate(t: Template) {
    setEditingId(t.id);
    setEditorName(t.name);
    setEditorRows(t.components.length ? rowsFromComponents(t.components) : [emptyComponentRow()]);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function componentsPayload() {
    return editorRows.map((r, i) => ({
      name: r.name.trim(),
      kind: r.kind,
      amountType: r.amountType,
      amount: r.amountType === "FLAT" ? Number(r.amount || 0) : 0,
      percentOfBasic: r.amountType === "PERCENT_OF_BASIC" ? Number(r.percentOfBasic || 0) : null,
      sortOrder: i,
    }));
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const name = editorName.trim();
    if (!name) {
      alert("Template name is required.");
      return;
    }
    const body = JSON.stringify({ name, components: componentsPayload() });
    const url = editingId === "new" ? "/api/hr/salary-structures" : `/api/hr/salary-structures/${editingId}`;
    const method = editingId === "new" ? "POST" : "PATCH";
    const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Could not save template.");
      return;
    }
    setEditingId(null);
    void loadTemplates();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this salary template?")) return;
    const res = await fetch(`/api/hr/salary-structures/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "Could not delete.");
      return;
    }
    void loadTemplates();
  }

  async function generate() {
    const res = await fetch("/api/hr/payroll/generate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth: month }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((j as { error?: string }).error ?? "Run payroll failed.");
      return;
    }
    void loadRuns();
    const r = j as { payslipCount?: number; emailsSent?: number; emailsSkipped?: number; smtpConfigured?: boolean };
    const emailNote = r.smtpConfigured
      ? `${r.emailsSent ?? 0} payslip email(s) sent${r.emailsSkipped ? `, ${r.emailsSkipped} skipped (no email on file)` : ""}.`
      : "Payslip emails were not sent — SMTP is not configured.";
    alert(`Payroll run complete: ${r.payslipCount ?? 0} payslips generated, accrual journal posted. ${emailNote}`);
  }

  async function toggleRun(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!payslipsByRun[runId]) {
      const res = await fetch(`/api/hr/payroll/${runId}/payslips`, { credentials: "include" });
      const data = await parseResponseJson<{ payslips?: PayslipRow[] }>(res, {});
      setPayslipsByRun((m) => ({ ...m, [runId]: data.payslips ?? [] }));
    }
  }

  async function sendPayslip(runId: string, payslipId: string) {
    setSendingId(payslipId);
    setSendStatus((s) => ({ ...s, [payslipId]: "" }));
    const res = await fetch(`/api/hr/payroll/${runId}/payslips/${payslipId}/send`, { method: "POST", credentials: "include" });
    const j = await res.json().catch(() => ({}));
    setSendingId(null);
    setSendStatus((s) => ({ ...s, [payslipId]: res.ok ? "Sent" : ((j as { error?: string }).error ?? "Failed") }));
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Salary templates</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reusable company-wide templates. Assign one to an employee, or customize per-employee from their profile.</p>
          </div>
          {editingId === null ? (
            <button type="button" onClick={startNewTemplate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              + New template
            </button>
          ) : null}
        </div>

        {editingId !== null ? (
          <form onSubmit={saveTemplate} className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <label className="block text-sm">
              <span className="font-medium">Template name</span>
              <input required value={editorName} onChange={(e) => setEditorName(e.target.value)} className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <SalaryComponentEditor rows={editorRows} onChange={setEditorRows} />
            <div className="flex gap-3">
              <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                Save template
              </button>
              <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Components</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{t.components.map((c) => c.name).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => startEditTemplate(t)} className="mr-4 text-xs text-teal-700 hover:underline dark:text-teal-400">
                      Edit
                    </button>
                    <button type="button" onClick={() => void deleteTemplate(t.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No templates yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Run payroll</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="font-medium">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <button type="button" onClick={() => void generate()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Run payroll
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Runs</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payslips</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono">{r.yearMonth}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === "APPROVED" || r.status === "PAID"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                            : r.status === "PENDING_APPROVAL"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                              : "rounded-full bg-slate-200 px-2 py-0.5 text-xs"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.payslipCount}</td>
                    <td className="px-4 py-3 text-right">
                      {r.payslipCount > 0 ? (
                        <button type="button" onClick={() => void toggleRun(r.id)} className="text-xs text-teal-700 hover:underline dark:text-teal-400">
                          {expandedRunId === r.id ? "Hide payslips" : "Show payslips"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expandedRunId === r.id ? (
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                      <td colSpan={4} className="px-4 py-3">
                        <table className="w-full text-xs">
                          <thead className="text-left uppercase text-slate-400">
                            <tr>
                              <th className="py-1 pr-3">Employee</th>
                              <th className="py-1 pr-3">Net pay</th>
                              <th className="py-1 pr-3">Email</th>
                              <th className="py-1 pr-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {(payslipsByRun[r.id] ?? []).map((p) => (
                              <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                                <td className="py-1.5 pr-3">
                                  {p.employeeName} <span className="text-slate-400">({p.employeeNumber})</span>
                                </td>
                                <td className="py-1.5 pr-3 tabular-nums">{p.netPay.toFixed(2)}</td>
                                <td className="py-1.5 pr-3">{p.hasEmail ? "On file" : "None"}</td>
                                <td className="py-1.5 pr-3 text-right">
                                  <button
                                    type="button"
                                    disabled={!p.hasEmail || sendingId === p.id}
                                    onClick={() => void sendPayslip(r.id, p.id)}
                                    className="rounded-md bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {sendingId === p.id ? "Sending…" : "Send"}
                                  </button>
                                  {sendStatus[p.id] ? <span className="ml-2 text-slate-500">{sendStatus[p.id]}</span> : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
