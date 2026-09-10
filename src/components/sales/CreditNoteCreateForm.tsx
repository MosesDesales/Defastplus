"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type CustomerOpt = { id: string; displayName: string };
type ItemOpt = { id: string; name: string; salesRate: number; sellable: boolean };
type InvOpt = { id: string; invoiceNumber: string };

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

type Line = { itemId: string; description: string; quantity: string; rate: string };

export function CreditNoteCreateForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [invoices, setInvoices] = useState<InvOpt[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [issueNow, setIssueNow] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", description: "", quantity: "1", rate: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [cRes, iRes] = await Promise.all([
        fetch("/api/customers", { cache: "no-store", credentials: "include" }),
        fetch("/api/items", { cache: "no-store", credentials: "include" }),
      ]);
      const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
      const iData = await parseResponseJson<{ items?: ItemOpt[] }>(iRes, {});
      setCustomers(cData.customers ?? []);
      setItems((iData.items ?? []).filter((it) => it.sellable !== false));
    })();
  }, []);

  useEffect(() => {
    if (!customerId) {
      setInvoices([]);
      setInvoiceId("");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/invoices?customerId=${encodeURIComponent(customerId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await parseResponseJson<{ invoices?: { id: string; invoiceNumber: string }[] }>(res, {});
      setInvoices(data.invoices ?? []);
    })();
  }, [customerId]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function onPickItem(i: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setLine(i, {
      itemId,
      description: it?.name ?? "",
      rate: it ? String(it.salesRate) : "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      alert("Select a customer.");
      return;
    }
    const bodyLines = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        itemId: l.itemId || null,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        rate: Number(l.rate),
      }));
    if (bodyLines.length === 0) {
      alert("Add at least one line.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales/credit-notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          invoiceId: invoiceId || null,
          issueDate,
          reason: reason.trim() || null,
          lines: bodyLines,
          issueNow,
        }),
      });
      const data = await parseResponseJson<{ creditNote?: { id: string }; error?: string }>(res, {});
      if (!res.ok) {
        alert(data.error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/sales/credit-notes");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reference invoice (optional)</label>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={`${inputClass} mt-1`} disabled={!customerId}>
            <option value="">None</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-1`} placeholder="Return, overcharge adjustment, …" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} />
            Issue immediately (post to ledger: Dr Sales / Dr GST / Cr AR)
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Lines</h2>
        <div className="mt-4 space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Item</label>
                <select value={line.itemId} onChange={(e) => onPickItem(i, e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Custom</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
                <input value={line.description} onChange={(e) => setLine(i, { description: e.target.value })} className={`${inputClass} mt-1`} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Qty</label>
                <input value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className={`${inputClass} mt-1`} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Rate</label>
                <input value={line.rate} onChange={(e) => setLine(i, { rate: e.target.value })} className={`${inputClass} mt-1`} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((l) => [...l, { itemId: "", description: "", quantity: "1", rate: "" }])}
            className="text-sm font-medium text-teal-600 dark:text-teal-400"
          >
            + Add line
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <Link href="/dashboard/sales/credit-notes" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200">
          Cancel
        </Link>
      </div>
    </form>
  );
}
