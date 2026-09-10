"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

const STATUSES = ["DRAFT", "SENT", "RECEIVED", "BILLED", "CANCELLED"] as const;

export function PurchaseOrderDetailClient({ poId }: { poId: string }) {
  const router = useRouter();
  const [po, setPo] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("DRAFT");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/purchases/purchase-orders/${poId}`, { cache: "no-store" });
      const j = await parseResponseJson<{ purchaseOrder?: Record<string, unknown> }>(res, {});
      const p = j.purchaseOrder;
      if (!res.ok || !p) setPo(null);
      else {
        setPo(p);
        setStatus(String(p.status));
      }
    })();
  }, [poId]);

  async function saveStatus() {
    const res = await fetch(`/api/purchases/purchase-orders/${poId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
  }

  if (!po) return <p className="px-4 py-8 text-slate-500">Loading…</p>;

  const lines = po.lines as Array<Record<string, unknown>>;
  const bills = po.bills as Array<{ id: string; billNumber: string }>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/purchases/purchase-orders" className="text-sm font-medium text-teal-600 dark:text-teal-400">
        ← Purchase orders
      </Link>
      <h1 className="mt-4 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{String(po.poNumber)}</h1>
      <p className="text-slate-600 dark:text-slate-400">{String(po.vendorName)}</p>
      {po.deliverySnapshot ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Deliver to</p>
          <p className="mt-1 text-slate-800 dark:text-slate-200">{String(po.deliverySnapshot)}</p>
        </div>
      ) : null}
      {po.memo ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Notes</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{String(po.memo)}</p>
        </div>
      ) : null}
      {po.termsAndConditions ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Terms &amp; conditions</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{String(po.termsAndConditions)}</p>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void saveStatus()} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
          Update status
        </button>
        <Link
          href={`/dashboard/purchases/bills/new?purchaseOrderId=${poId}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Convert to bill
        </Link>
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={String(l.id)} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-4 py-3">{String(l.description)}</td>
                <td className="px-4 py-3 text-right">{Number(l.quantity)}</td>
                <td className="px-4 py-3 text-right">{Number(l.rate).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{Number(l.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bills?.length ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Linked bills</p>
          <ul className="mt-2 list-inside list-disc text-sm text-teal-600 dark:text-teal-400">
            {bills.map((b) => (
              <li key={b.id}>
                <Link href={`/dashboard/purchases/bills/${b.id}`}>{b.billNumber}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
