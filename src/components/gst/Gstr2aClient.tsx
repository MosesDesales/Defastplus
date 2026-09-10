"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Row = {
  billId: string;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  status: string;
};

export function Gstr2aClient() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ month });
    if (vendorId.trim()) q.set("vendorId", vendorId.trim());
    if (status !== "ALL") q.set("status", status);
    const res = await fetch(`/api/gst/gstr2a?${q}`, { credentials: "include" });
    const data = await parseResponseJson<{ rows?: Row[]; mismatchAlerts?: string[] }>(res, {});
    setRows(data.rows ?? []);
    setAlerts(data.mismatchAlerts ?? []);
    setLoading(false);
  }, [month, vendorId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchBill(billId: string, action: "MATCH" | "RECONCILE") {
    const res = await fetch(`/api/gst/gstr2a/${billId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, month }),
    });
    if (!res.ok) {
      alert("Could not update.");
      return;
    }
    void load();
  }

  const badge = (s: string) => {
    const cls =
      s === "RECONCILED"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        : s === "MATCHED"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Vendor ID</span>
          <input
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder="Optional filter"
            className="mt-1 block w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="MATCHED">Matched</option>
            <option value="RECONCILED">Reconciled</option>
          </select>
        </label>
      </div>

      {alerts.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Reconciliation alerts</p>
          <ul className="mt-2 list-disc pl-5">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Vendor / GSTIN</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">CGST</th>
              <th className="px-4 py-3 text-right">SGST</th>
              <th className="px-4 py-3 text-right">IGST</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No bills for this period (non-draft bills only).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.billId} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{r.vendorName}</div>
                    <div className="text-xs text-slate-500">{r.vendorGstin ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <div>{r.invoiceNumber}</div>
                    <div className="text-xs text-slate-500">{r.invoiceDate}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.taxableValue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.cgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.sgst.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.igst.toFixed(2)}</td>
                  <td className="px-4 py-3">{badge(r.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void patchBill(r.billId, "MATCH")} className="rounded border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                        Match
                      </button>
                      <button type="button" onClick={() => void patchBill(r.billId, "RECONCILE")} className="rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700">
                        Reconcile
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
