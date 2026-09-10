"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingOrIfsc: string | null;
  currency: string;
  kind: string;
  status: string;
  openingBalance: number;
  openingBalanceDate: string | null;
  chartAccount: { id: string; code: string; name: string } | null;
  currentBalance: number;
  unreconciledCount: number;
  lastSyncAt: string | null;
};

type ChartOpt = { id: string; code: string; name: string };

const KINDS = ["SAVINGS", "CURRENT", "CREDIT_CARD", "CASH"] as const;

export function BankingAccountsClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [charts, setCharts] = useState<ChartOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingOrIfsc: "",
    currency: "INR",
    kind: "CURRENT" as (typeof KINDS)[number],
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    openingBalance: "0",
    openingBalanceDate: "",
    chartAccountId: "",
  });

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([
      fetch("/api/banking/accounts"),
      fetch("/api/banking/chart-accounts"),
    ]);
    const aj = (await a.json()) as { accounts?: Row[]; error?: string };
    const cj = (await c.json()) as { accounts?: ChartOpt[] };
    if (!a.ok) {
      setErr(aj.error ?? "Failed to load");
      setRows([]);
      return;
    }
    setErr(null);
    setRows(aj.accounts ?? []);
    setCharts(cj.accounts ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditId(null);
    setForm({
      bankName: "",
      accountName: "",
      accountNumber: "",
      routingOrIfsc: "",
      currency: "INR",
      kind: "CURRENT",
      status: "ACTIVE",
      openingBalance: "0",
      openingBalanceDate: "",
      chartAccountId: "",
    });
    setModal("add");
  }

  function openEdit(r: Row) {
    setEditId(r.id);
    setForm({
      bankName: r.bankName,
      accountName: r.accountName,
      accountNumber: r.accountNumber,
      routingOrIfsc: r.routingOrIfsc ?? "",
      currency: r.currency,
      kind: r.kind as (typeof KINDS)[number],
      status: r.status as "ACTIVE" | "INACTIVE",
      openingBalance: String(r.openingBalance),
      openingBalanceDate: r.openingBalanceDate ?? "",
      chartAccountId: r.chartAccount?.id ?? "",
    });
    setModal("edit");
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        bankName: form.bankName.trim(),
        accountName: form.accountName.trim(),
        accountNumber: form.accountNumber.trim(),
        routingOrIfsc: form.routingOrIfsc.trim() || null,
        currency: form.currency.trim() || "INR",
        kind: form.kind,
        status: form.status,
        openingBalance: Number(form.openingBalance) || 0,
        openingBalanceDate: form.openingBalanceDate.trim() || null,
        chartAccountId: form.chartAccountId.trim() || null,
      };
      const res = await fetch(modal === "add" ? "/api/banking/accounts" : `/api/banking/accounts/${editId}`, {
        method: modal === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Save failed");
        return;
      }
      setModal(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this bank account and all imported transactions?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/banking/accounts/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) setErr(data.error ?? "Delete failed");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">Manage operating bank books and GL links for payouts.</p>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          + Add bank account
        </button>
      </div>

      {err ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30">{err}</div> : null}

      {rows === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No accounts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Unreconciled</th>
                <th className="px-4 py-3">GL bank</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.bankName}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    <div>{r.accountName}</div>
                    <div className="text-xs text-slate-500">****{r.accountNumber.slice(-4)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.kind.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {r.currency} {r.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{r.unreconciledCount}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {r.chartAccount ? `${r.chartAccount.code} · ${r.chartAccount.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-teal-700 hover:underline dark:text-teal-400" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <span className="mx-2 text-slate-300">|</span>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => void remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => !busy && setModal(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{modal === "add" ? "Add" : "Edit"} bank account</h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Bank name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Account name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Account number</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">IFSC / SWIFT</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.routingOrIfsc}
                  onChange={(e) => setForm((f) => ({ ...f, routingOrIfsc: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Currency</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Kind</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as (typeof KINDS)[number] }))}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Status</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Opening balance</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={form.openingBalance}
                    onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Opening date</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={form.openingBalanceDate}
                    onChange={(e) => setForm((f) => ({ ...f, openingBalanceDate: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Chart bank account (for bills & expenses)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.chartAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, chartAccountId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {charts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
