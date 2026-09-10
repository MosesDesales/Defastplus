"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto, ScheduleApiRow } from "@/components/accounting/fixed-asset-types";
import { formatInr, ymdFromIso } from "@/components/accounting/fixed-asset-format";

export function DepreciationScheduleReportClient() {
  const [assets, setAssets] = useState<FixedAssetDto[]>([]);
  const [assetId, setAssetId] = useState("");
  const [schedule, setSchedule] = useState<ScheduleApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedLoading, setSchedLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/accounting/fixed-assets", { cache: "no-store", credentials: "include" });
      const data = await parseResponseJson<{ assets?: FixedAssetDto[] }>(res, {});
      const list = data.assets ?? [];
      setAssets(list);
      if (list[0]) setAssetId(list[0].id);
      setLoading(false);
    })();
  }, []);

  const loadSchedule = useCallback(async (id: string) => {
    if (!id) return;
    setSchedLoading(true);
    const res = await fetch(
      `/api/accounting/depreciation/schedule?assetId=${encodeURIComponent(id)}&projected=48`,
      { cache: "no-store", credentials: "include" },
    );
    const data = await parseResponseJson<{ schedule?: ScheduleApiRow[] }>(res, {});
    setSchedule(data.schedule ?? []);
    setSchedLoading(false);
  }, []);

  useEffect(() => {
    if (!assetId) return;
    void loadSchedule(assetId);
  }, [assetId, loadSchedule]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Reports</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Depreciation schedule</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Posted periods and projected accruals from the asset policy (SLM or WDV).
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/dashboard/accounting/depreciation" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
          Run depreciation
        </Link>
        <Link href="/dashboard/reports" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
          All reports
        </Link>
      </div>

      <div className="mt-8">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset</label>
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          disabled={loading || assets.length === 0}
          className="mt-1 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.assetCode} — {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {schedLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading schedule…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Period start</th>
                  <th className="px-4 py-3 text-right font-semibold">Opening</th>
                  <th className="px-4 py-3 text-right font-semibold">Depreciation</th>
                  <th className="px-4 py-3 text-right font-semibold">Closing</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schedule.map((r, i) => (
                  <tr key={`${r.periodStart}-${i}`}>
                    <td className="px-4 py-3 tabular-nums">{ymdFromIso(r.periodStart)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(r.openingValue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(r.depreciationAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(r.closingValue)}</td>
                    <td className="px-4 py-3">{r.posted ? "Posted" : "Projected"}</td>
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
