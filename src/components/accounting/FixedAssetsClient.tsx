"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto, FixedAssetStatus } from "@/components/accounting/fixed-asset-types";
import { formatInr } from "@/components/accounting/fixed-asset-format";

const STATUS_LABEL: Record<FixedAssetStatus, string> = {
  ACTIVE: "Active",
  FULLY_DEPRECIATED: "Fully depreciated",
  DISPOSED: "Disposed",
};

const STATUS_CLASS: Record<FixedAssetStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  FULLY_DEPRECIATED: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  DISPOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function FixedAssetsClient() {
  const [rows, setRows] = useState<FixedAssetDto[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    const res = await fetch(`/api/accounting/fixed-assets?${p.toString()}`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await parseResponseJson<{ assets?: FixedAssetDto[] }>(res, {});
    setRows(data.assets ?? []);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.assetCode.localeCompare(b.assetCode, undefined, { sensitivity: "base" })),
    [rows],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Fixed assets</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Register assets, link GL accounts, then run depreciation from the Depreciation screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/accounting/depreciation"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-teal-600"
          >
            Depreciation
          </Link>
          <Link
            href="/dashboard/accounting/fixed-assets/new"
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            New asset
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="FULLY_DEPRECIATED">Fully depreciated</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </label>
        <Link
          href="/dashboard/reports/fixed-asset-register"
          className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          Fixed asset register report
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-400">No assets yet. Create one to begin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Accum. dep.</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Book value</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">{r.assetCode}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">{r.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status as FixedAssetStatus] ?? STATUS_CLASS.ACTIVE}`}
                      >
                        {STATUS_LABEL[r.status as FixedAssetStatus] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {formatInr(r.purchaseCost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {formatInr(r.accumulatedDepreciation)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatInr(r.currentBookValue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/accounting/fixed-assets/${r.id}`}
                        className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                      >
                        View
                      </Link>
                    </td>
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
