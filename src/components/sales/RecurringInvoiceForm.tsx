"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RecurringFrequency } from "@prisma/client";
import { parseResponseJson } from "@/lib/parse-response-json";
import { parseYmd } from "@/lib/dates";
import { advanceRecurringDate } from "@/lib/purchases/recurring-dates";

type CustomerOpt = { id: string; displayName: string };
type ItemOpt = { id: string; name: string; salesRate: number; gstRate: number; sellable: boolean };

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const FREQ: { value: RecurringFrequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

type Line = { itemId: string; description: string; quantity: string; rate: string };

export function RecurringInvoiceForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("MONTHLY");
  const [repeatEvery, setRepeatEvery] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [neverExpires, setNeverExpires] = useState(true);
  const [nextRunDate, setNextRunDate] = useState("");
  const [autoEmail, setAutoEmail] = useState(false);
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

  const nextHint = useMemo(() => {
    const base = nextRunDate.trim() || startDate;
    const d = parseYmd(base);
    if (Number.isNaN(d.getTime())) return "";
    const re = Math.max(1, parseInt(repeatEvery, 10) || 1);
    const n = advanceRecurringDate(d, frequency, re);
    return `After save, first generation is scheduled for ${d.toLocaleDateString()}; then approximately ${n.toLocaleDateString()}.`;
  }, [startDate, nextRunDate, frequency, repeatEvery]);

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
    const re = Math.max(1, parseInt(repeatEvery, 10) || 1);
    const bodyLines = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        itemId: l.itemId || null,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        rate: Number(l.rate),
      }));
    if (bodyLines.length === 0) {
      alert("Add at least one line with a description.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales/recurring-invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          profileName: profileName.trim() || null,
          frequency,
          repeatEvery: re,
          startDate,
          endDate: neverExpires ? null : endDate || null,
          nextRunDate: nextRunDate.trim() || null,
          autoEmail,
          lines: bodyLines,
        }),
      });
      const data = await parseResponseJson<{ recurringInvoice?: { id: string }; error?: string }>(res, {});
      if (!res.ok) {
        alert(data.error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/sales/recurring-invoices");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Profile name (optional)</label>
          <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={`${inputClass} mt-1`} placeholder="e.g. Monthly retainer" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className={`${inputClass} mt-1`}>
            {FREQ.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Repeat every</label>
          <input
            type="number"
            min={1}
            max={366}
            value={repeatEvery}
            onChange={(e) => setRepeatEvery(e.target.value)}
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-slate-500">Intervals of the selected frequency (e.g. 2 = every 2 months).</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Next run date</label>
          <input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} className={`${inputClass} mt-1`} />
          <p className="mt-1 text-xs text-slate-500">Defaults to start date if empty.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={neverExpires} onChange={(e) => setNeverExpires(e.target.checked)} />
            No end date
          </label>
          {!neverExpires ? (
            <div className="mt-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} mt-1`} />
            </div>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={autoEmail} onChange={(e) => setAutoEmail(e.target.checked)} />
            Auto send email when an invoice is generated (requires SMTP)
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Invoice lines</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">GST follows each catalog item. Taxable items need HSN/SAC on the item.</p>
        <div className="mt-4 space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Item</label>
                <select value={line.itemId} onChange={(e) => onPickItem(i, e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Custom line</option>
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

      {nextHint ? <p className="text-sm text-slate-600 dark:text-slate-400">{nextHint}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
        <Link href="/dashboard/sales/recurring-invoices" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200">
          Cancel
        </Link>
      </div>
    </form>
  );
}
