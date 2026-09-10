"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto } from "@/components/accounting/fixed-asset-types";
import { formatInr, ymdFromIso } from "@/components/accounting/fixed-asset-format";

export function AssetDisposalReportClient() {
  const [rows, setRows] = useState<FixedAssetDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/fixed-assets?status=DISPOSED", {
      cache: "no-store",
      credentials: "include",
    });
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
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Asset disposal report</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Disposed assets with proceeds and recognised gain or loss.</p>
      <Link href="/dashboard/accounting/fixed-assets" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
        ← Fixed assets
      </Link>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-400">No disposals recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Disposed</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Proceeds</th>
                  <th className="px-4 py-3 text-right font-semibold">Gain (loss)</th>
                  <th className="px-4 py-3 text-left font-semibold">Journal</th>
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
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {r.disposedAt ? ymdFromIso(r.disposedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">{r.disposalType ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.disposalProceeds != null ? formatInr(r.disposalProceeds) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.disposalGainOrLoss != null ? formatInr(r.disposalGainOrLoss) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.disposalJournalId ? (
                        <Link
                          href={`/dashboard/accounting/manual-journal/${r.disposalJournalId}/edit`}
                          className="text-teal-700 hover:underline dark:text-teal-400"
                        >
                          Open
                        </Link>
                      ) : (
                        "—"
                      )}
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
