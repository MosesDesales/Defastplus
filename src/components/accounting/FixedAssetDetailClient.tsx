"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { DepreciationEntryRow, FixedAssetDto, ScheduleApiRow } from "@/components/accounting/fixed-asset-types";
import { formatInr, ymdFromIso } from "@/components/accounting/fixed-asset-format";

type Props = { assetId: string };

export function FixedAssetDetailClient({ assetId }: Props) {
  const router = useRouter();
  const [asset, setAsset] = useState<FixedAssetDto | null>(null);
  const [entries, setEntries] = useState<DepreciationEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<ScheduleApiRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeType, setDisposeType] = useState<"SELL" | "SCRAP">("SCRAP");
  const [disposeProceeds, setDisposeProceeds] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [disposeErr, setDisposeErr] = useState<string | null>(null);
  const [disposing, setDisposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/accounting/fixed-assets/${assetId}`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await parseResponseJson<{
      asset?: FixedAssetDto;
      depreciationEntries?: DepreciationEntryRow[];
    }>(res, {});
    setAsset(data.asset ?? null);
    setEntries(data.depreciationEntries ?? []);
    setLoading(false);
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openSchedule() {
    setScheduleOpen(true);
    setScheduleLoading(true);
    const res = await fetch(
      `/api/accounting/depreciation/schedule?assetId=${encodeURIComponent(assetId)}&projected=36`,
      { cache: "no-store", credentials: "include" },
    );
    const data = await parseResponseJson<{ schedule?: ScheduleApiRow[] }>(res, {});
    setScheduleRows(data.schedule ?? []);
    setScheduleLoading(false);
  }

  useEffect(() => {
    if (!disposeOpen) return;
    void (async () => {
      const res = await fetch("/api/accounting/accounts?type=ASSET", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await parseResponseJson<{ accounts?: { id: string; code: string; name: string }[] }>(res, {});
      setAccounts(data.accounts ?? []);
    })();
  }, [disposeOpen]);

  async function submitDispose() {
    setDisposeErr(null);
    setDisposing(true);
    const proceeds = disposeType === "SELL" ? Number(disposeProceeds || 0) : 0;
    const res = await fetch(`/api/accounting/fixed-assets/${assetId}/dispose`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: disposeType,
        proceeds: disposeType === "SELL" ? proceeds : 0,
        cashAccountId: disposeType === "SELL" && proceeds > 0 ? cashAccountId : null,
      }),
    });
    const data = await parseResponseJson<{ error?: string }>(res, {});
    if (!res.ok) {
      setDisposeErr(data.error ?? "Disposal failed.");
      setDisposing(false);
      return;
    }
    setDisposeOpen(false);
    setDisposing(false);
    await load();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-600">Asset not found.</p>
        <Link href="/dashboard/accounting/fixed-assets" className="mt-4 inline-block text-teal-700 hover:underline dark:text-teal-400">
          Back to list
        </Link>
      </div>
    );
  }

  const canDispose = asset.status === "ACTIVE" || asset.status === "FULLY_DEPRECIATED";
  const canEdit = asset.status !== "DISPOSED";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{asset.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-600 dark:text-slate-400">{asset.assetCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openSchedule()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            Depreciation schedule
          </button>
          {canEdit ? (
            <Link
              href={`/dashboard/accounting/fixed-assets/${assetId}/edit`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              Edit
            </Link>
          ) : null}
          {canDispose ? (
            <button
              type="button"
              onClick={() => {
                setDisposeErr(null);
                setDisposeOpen(true);
              }}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
            >
              Dispose
            </button>
          ) : null}
          <Link
            href="/dashboard/accounting/fixed-assets"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400"
          >
            All assets
          </Link>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{asset.status.replace(/_/g, " ")}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchase cost</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{formatInr(asset.purchaseCost)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Accumulated depreciation</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{formatInr(asset.accumulatedDepreciation)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Book value</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-teal-800 dark:text-teal-300">{formatInr(asset.currentBookValue)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Method / frequency</dt>
          <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
            {asset.depreciationMethod === "STRAIGHT_LINE" ? "Straight line" : "WDV"}
            {asset.wdvAnnualPercent != null ? ` (${asset.wdvAnnualPercent}% p.a.)` : ""}
            <br />
            <span className="text-slate-500">{asset.scheduleFrequency.toLowerCase()} accruals</span>
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Salvage / life</dt>
          <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
            {formatInr(asset.salvageValue)} salvage · {asset.usefulLifeYears} years
          </dd>
        </div>
      </dl>

      {asset.status === "DISPOSED" ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Disposed</p>
          <p className="mt-1">
            Type: {asset.disposalType ?? "—"} · Proceeds: {asset.disposalProceeds != null ? formatInr(asset.disposalProceeds) : "—"} · Gain
            (loss): {asset.disposalGainOrLoss != null ? formatInr(asset.disposalGainOrLoss) : "—"}
          </p>
          {asset.disposalJournalId ? (
            <Link
              href={`/dashboard/accounting/manual-journal/${asset.disposalJournalId}/edit`}
              className="mt-2 inline-block font-medium text-teal-800 underline dark:text-teal-300"
            >
              View disposal journal
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Posted depreciation</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Each row is Dr depreciation expense, Cr accumulated depreciation, linked to this asset.
        </p>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No postings yet. Use Depreciation to accrue for open periods.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Period</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Opening</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Closing</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 tabular-nums text-slate-800 dark:text-slate-200">{ymdFromIso(e.periodStart)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatInr(e.openingBookValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatInr(e.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatInr(e.closingBookValue)}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/accounting/manual-journal/${e.journalEntryId}/edit`}
                        className="text-teal-700 hover:underline dark:text-teal-400"
                      >
                        {e.journalReferenceNo ?? e.journalEntryId.slice(0, 8)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scheduleOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Depreciation schedule</h3>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(85vh-3.5rem)] overflow-auto p-4">
              {scheduleLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                      <th className="py-2 pr-2">Period start</th>
                      <th className="py-2 pr-2 text-right">Opening</th>
                      <th className="py-2 pr-2 text-right">Depreciation</th>
                      <th className="py-2 pr-2 text-right">Closing</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((r, i) => (
                      <tr key={`${r.periodStart}-${i}`} className="border-b border-slate-100 dark:border-slate-800/80">
                        <td className="py-2 pr-2 tabular-nums">{ymdFromIso(r.periodStart)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatInr(r.openingValue)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatInr(r.depreciationAmount)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatInr(r.closingValue)}</td>
                        <td className="py-2">{r.posted ? "Posted" : "Projected"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {disposeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Dispose asset</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Posts disposal journals (cash, accumulated depreciation, asset, and gain or loss accounts).
            </p>
            {disposeErr ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{disposeErr}</p> : null}
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
              <select
                value={disposeType}
                onChange={(e) => setDisposeType(e.target.value as "SELL" | "SCRAP")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="SCRAP">Scrap (no proceeds)</option>
                <option value="SELL">Sell</option>
              </select>
              {disposeType === "SELL" ? (
                <>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Proceeds</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={disposeProceeds}
                    onChange={(e) => setDisposeProceeds(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cash / bank account</label>
                  <select
                    value={cashAccountId}
                    onChange={(e) => setCashAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">Select</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisposeOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disposing}
                onClick={() => void submitDispose()}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {disposing ? "Posting…" : "Confirm disposal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
