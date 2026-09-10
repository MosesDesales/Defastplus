"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import { CreditNoteActionsCell } from "@/components/sales/CreditNoteActionsCell";

type Row = {
  id: string;
  creditNumber: string;
  issueDate: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  status: string;
  total: number;
  amountApplied: number;
  balance: number;
  reason: string | null;
  posted: boolean;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CreditNotesListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [applyFor, setApplyFor] = useState<Row | null>(null);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [invoices, setInvoices] = useState<{ id: string; invoiceNumber: string; balance: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sales/credit-notes", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ creditNotes?: Row[] }>(res, {});
    setRows(data.creditNotes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!applyFor) {
      setInvoices([]);
      setApplyInvoiceId("");
      setApplyAmount("");
      return;
    }
    void (async () => {
      const res = await fetch(
        `/api/invoices?customerId=${encodeURIComponent(applyFor.customerId)}&status=SENT,PARTIALLY_PAID`,
        { cache: "no-store", credentials: "include" },
      );
      const data = await parseResponseJson<{ invoices?: { id: string; invoiceNumber: string; balance: number }[] }>(res, {});
      setInvoices(data.invoices ?? []);
    })();
  }, [applyFor]);

  async function issueDraft(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/sales/credit-notes/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue" }),
      });
      if (!res.ok) {
        const d = await parseResponseJson<{ error?: string }>(res, {});
        alert(d.error ?? "Could not issue");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function submitApply() {
    if (!applyFor) return;
    const amt = parseFloat(applyAmount);
    if (!applyInvoiceId || Number.isNaN(amt) || amt <= 0) {
      alert("Select an invoice and enter a valid amount.");
      return;
    }
    setBusy(applyFor.id);
    try {
      const res = await fetch(`/api/sales/credit-notes/${applyFor.id}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: applyInvoiceId, amount: amt }),
      });
      const d = await parseResponseJson<{ error?: string }>(res, {});
      if (!res.ok) {
        alert(d.error ?? "Apply failed");
        return;
      }
      setApplyFor(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="mt-10 text-sm text-slate-500">Loading…</p>;

  if (rows.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-slate-200 px-8 py-16 text-center dark:border-slate-700">
        <p className="text-slate-600 dark:text-slate-400">No credit notes yet.</p>
        <Link href="/dashboard/sales/credit-notes/new" className="mt-4 inline-block text-sm font-medium text-teal-600 dark:text-teal-400">
          Create credit note
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80">
            <tr>
              <th className="px-4 py-3">Credit#</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Issue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">{r.creditNumber}</td>
                <td className="px-4 py-3">{r.customerName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.total)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.balance)}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === "DRAFT" ? (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void issueDraft(r.id)}
                      className="rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      Issue
                    </button>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <CreditNoteActionsCell
                    creditNoteId={r.id}
                    creditNumber={r.creditNumber}
                    customerName={r.customerName}
                    customerEmail={r.customerEmail}
                    issueDate={r.issueDate}
                    total={fmt(r.total)}
                    status={r.status}
                    reason={r.reason}
                    balance={fmt(r.balance)}
                    balanceNum={r.balance}
                    onApply={() => setApplyFor(r)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applyFor ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Apply credit to invoice</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {applyFor.creditNumber} · balance {fmt(applyFor.balance)}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice</label>
            <select
              value={applyInvoiceId}
              onChange={(e) => setApplyInvoiceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">Select…</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} (balance {fmt(inv.balance)})
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</label>
            <input
              value={applyAmount}
              onChange={(e) => setApplyAmount(e.target.value)}
              type="number"
              step="0.01"
              min="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyFor(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === applyFor.id}
                onClick={() => void submitApply()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
