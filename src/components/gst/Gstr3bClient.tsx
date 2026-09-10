"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Payload = {
  month: string;
  outwardSupplies: { taxableValue: number; cgst: number; sgst: number; igst: number };
  inwardSupplies: { taxableValue: number; cgst: number; sgst: number; igst: number };
  itc: { cgst: number; sgst: number; igst: number };
  taxPayable: { cgst: number; sgst: number; igst: number };
};

export function Gstr3bClient() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/gst/gstr3b?month=${encodeURIComponent(month)}`, { credentials: "include" });
    const j = await parseResponseJson<Payload>(res, {} as Payload);
    setData(j);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GSTR3B-${data.month}.json`;
    a.click();
  }

  function exportExcel() {
    window.open(`/api/gst/gstr3b?month=${encodeURIComponent(month)}&format=excel`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Return month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={exportJson} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
            Export JSON
          </button>
          <button type="button" onClick={exportExcel} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Export CSV
          </button>
        </div>
      </div>

      {loading || !data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Outward supplies (sales)</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Taxable value</dt>
                <dd className="tabular-nums font-medium">{data.outwardSupplies.taxableValue.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>CGST</dt>
                <dd className="tabular-nums">{data.outwardSupplies.cgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>SGST</dt>
                <dd className="tabular-nums">{data.outwardSupplies.sgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>IGST</dt>
                <dd className="tabular-nums">{data.outwardSupplies.igst.toFixed(2)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Inward supplies / ITC (purchases)</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Taxable value</dt>
                <dd className="tabular-nums font-medium">{data.inwardSupplies.taxableValue.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ITC CGST</dt>
                <dd className="tabular-nums">{data.itc.cgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ITC SGST</dt>
                <dd className="tabular-nums">{data.itc.sgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ITC IGST</dt>
                <dd className="tabular-nums">{data.itc.igst.toFixed(2)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Net tax payable (illustrative)</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="flex justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                <dt>CGST</dt>
                <dd className="tabular-nums font-semibold">{data.taxPayable.cgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                <dt>SGST</dt>
                <dd className="tabular-nums font-semibold">{data.taxPayable.sgst.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                <dt>IGST</dt>
                <dd className="tabular-nums font-semibold">{data.taxPayable.igst.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Reverse charge section reserved (nil in demo). Figures follow Sales / Purchases line taxes.</p>
          </section>
        </div>
      )}
    </div>
  );
}
