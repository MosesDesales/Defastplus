"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

type Line = { itemId: string; description: string; quantity: string; rate: string };

export function PurchaseReturnCreateForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Array<{ id: string; displayName: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string; purchaseRate: number }>>([]);
  const [vendorId, setVendorId] = useState("");
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [dispatchNow, setDispatchNow] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", description: "", quantity: "1", rate: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [vRes, iRes] = await Promise.all([
        fetch("/api/purchases/vendors", { credentials: "include" }),
        fetch("/api/items", { credentials: "include" }),
      ]);
      const vData = await parseResponseJson<{ vendors?: { id: string; displayName: string }[] }>(vRes, {});
      const iData = await parseResponseJson<{ items?: { id: string; name: string; purchaseRate: number }[] }>(iRes, {});
      setVendors(vData.vendors ?? []);
      setItems(iData.items ?? []);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) return alert("Select a vendor");
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
      const res = await fetch("/api/purchases/purchase-returns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          returnDate,
          reason: reason.trim() || null,
          dispatchNow,
          lines: bodyLines,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not save");
        return;
      }
      router.push(`/dashboard/purchases/purchase-returns/${(j as { purchaseReturn: { id: string } }).purchaseReturn.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/purchases/purchase-returns" className="text-sm font-medium text-teal-600 hover:underline">
        ← Purchase returns
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">New purchase return</h1>

      <label className="block text-sm">
        Vendor *
        <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`mt-1 ${inputClass}`}>
          <option value="">Select</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Return date *
          <input type="date" required value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-sm">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

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
                  rate: it ? String(it.purchaseRate) : line.rate,
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
            <input placeholder="Description" value={line.description} onChange={(e) => { const next = [...lines]; next[i] = { ...line, description: e.target.value }; setLines(next); }} className={inputClass} />
            <input placeholder="Qty" value={line.quantity} onChange={(e) => { const next = [...lines]; next[i] = { ...line, quantity: e.target.value }; setLines(next); }} className={inputClass} />
            <input placeholder="Rate" value={line.rate} onChange={(e) => { const next = [...lines]; next[i] = { ...line, rate: e.target.value }; setLines(next); }} className={inputClass} />
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
        {saving ? "Saving…" : "Save return"}
      </button>
    </form>
  );
}
