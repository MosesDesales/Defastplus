"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto } from "@/components/accounting/fixed-asset-types";
import { formatInr } from "@/components/accounting/fixed-asset-format";

export function FixedAssetRegisterReportClient() {
  const [rows, setRows] = useState<FixedAssetDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/fixed-assets", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ assets?: FixedAssetDto[] }>(res, {});
    setRows(data.assets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Reports</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Fixed asset register</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Cost, accumulated depreciation, and net book value by asset.
      </p>
      <Link href="/dashboard/accounting/fixed-assets" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
        ← Back to fixed assets
      </Link>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Accum. dep.</th>
                  <th className="px-4 py-3 text-right font-semibold">Book value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs">{r.assetCode}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/accounting/fixed-assets/${r.id}`} className="text-teal-700 hover:underline dark:text-teal-400">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(r.purchaseCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(r.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatInr(r.currentBookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
