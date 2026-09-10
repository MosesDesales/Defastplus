"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto } from "@/components/accounting/fixed-asset-types";

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DepreciationRunClient() {
  const [assets, setAssets] = useState<FixedAssetDto[]>([]);
  const [asOf, setAsOf] = useState(todayYmd);
  const [assetId, setAssetId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    posted: number;
    skipped: number;
    wouldPost: number;
    errors: string[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    const res = await fetch("/api/accounting/fixed-assets?status=ACTIVE", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await parseResponseJson<{ assets?: FixedAssetDto[] }>(res, {});
    setAssets(data.assets ?? []);
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    const res = await fetch("/api/accounting/depreciation/run", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asOf,
        assetId: assetId || undefined,
        dryRun,
      }),
    });
    const data = await parseResponseJson<{
      error?: string;
      posted?: number;
      skipped?: number;
      wouldPost?: number;
      errors?: string[];
    }>(res, {});
    if (!res.ok) {
      setErr(data.error ?? "Run failed.");
      setBusy(false);
      return;
    }
    setResult({
      posted: data.posted ?? 0,
      skipped: data.skipped ?? 0,
      wouldPost: data.wouldPost ?? 0,
      errors: data.errors ?? [],
    });
    setBusy(false);
    if (!dryRun) void loadAssets();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Depreciation</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Accrues depreciation for the period containing the selected date (month, quarter, or year per asset). Dry run
        shows what would post without creating journals.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/accounting/fixed-assets" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
          Fixed assets
        </Link>
        <Link
          href="/dashboard/reports/depreciation-schedule"
          className="font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          Schedule report
        </Link>
      </div>

      <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">As-of date</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset (optional)</label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All active assets</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run only (no journals)
        </label>
        {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          {busy ? "Running…" : "Run depreciation"}
        </button>
      </div>

      {result ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Result</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-slate-700 dark:text-slate-300">
            <li>Posted: {result.posted}</li>
            <li>Skipped (no amount or duplicate period): {result.skipped}</li>
            {dryRun ? <li>Would post: {result.wouldPost}</li> : null}
          </ul>
          {result.errors.length ? (
            <ul className="mt-3 list-inside list-disc text-red-700 dark:text-red-400">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
