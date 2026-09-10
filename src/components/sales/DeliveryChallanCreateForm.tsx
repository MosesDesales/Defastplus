"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

type Line = { itemId: string; description: string; quantity: string; rate: string };

export function DeliveryChallanCreateForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string; salesRate: number }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [dispatchNow, setDispatchNow] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", description: "", quantity: "1", rate: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [cRes, iRes] = await Promise.all([
        fetch("/api/customers", { credentials: "include" }),
        fetch("/api/items", { credentials: "include" }),
      ]);
      const cData = await parseResponseJson<{ customers?: { id: string; displayName: string }[] }>(cRes, {});
      const iData = await parseResponseJson<{ items?: { id: string; name: string; salesRate: number }[] }>(iRes, {});
      setCustomers(cData.customers ?? []);
      setItems(iData.items ?? []);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return alert("Select a customer");
    const bodyLines = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        itemId: l.itemId || null,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        rate: Number(l.rate),
      }));
    if (bodyLines.length === 0) return alert("Add at least one line");

    setSaving(true);
    try {
      const res = await fetch("/api/sales/delivery-challans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          challanDate,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          dispatchNow,
          lines: bodyLines,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not save");
        return;
      }
      router.push(`/dashboard/sales/delivery-challans/${(j as { challan: { id: string } }).challan.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/sales/delivery-challans" className="text-sm font-medium text-teal-600 hover:underline">
        ← Delivery challans
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">New delivery challan</h1>

      <label className="block text-sm">
        Customer *
        <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-1 ${inputClass}`}>
          <option value="">Select</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Date *
          <input type="date" required value={challanDate} onChange={(e) => setChallanDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-sm">
          Reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <label className="block text-sm">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${inputClass}`} />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium">Lines</p>
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4 dark:border-slate-700">
            <select
              value={line.itemId}
              onChange={(e) => {
                const it = items.find((x) => x.id === e.target.value);
                const next = [...lines];
                next[i] = {
                  itemId: e.target.value,
                  description: it?.name ?? line.description,
                  quantity: line.quantity,
                  rate: it ? String(it.salesRate) : line.rate,
                };
                setLines(next);
              }}
              className={inputClass}
            >
              <option value="">Item (optional)</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Description"
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, description: e.target.value };
                setLines(next);
              }}
              className={inputClass}
            />
            <input
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, quantity: e.target.value };
                setLines(next);
              }}
              className={inputClass}
            />
            <input
              placeholder="Rate"
              value={line.rate}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, rate: e.target.value };
                setLines(next);
              }}
              className={inputClass}
            />
          </div>
        ))}
        <button type="button" onClick={() => setLines((l) => [...l, { itemId: "", description: "", quantity: "1", rate: "" }])} className="text-sm text-teal-600">
          + Add line
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={dispatchNow} onChange={(e) => setDispatchNow(e.target.checked)} />
        Mark as dispatched (ready for E-Way Bill)
      </label>

      <button type="submit" disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save challan"}
      </button>
    </form>
  );
}
