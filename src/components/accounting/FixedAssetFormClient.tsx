"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { summarizeApiErrorBody } from "@/lib/api-error-message";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { FixedAssetDto } from "@/components/accounting/fixed-asset-types";
import { ymdFromIso } from "@/components/accounting/fixed-asset-format";

type AccountOpt = { id: string; code: string; name: string; type: string };

function findByCode(accounts: AccountOpt[], code: string) {
  return accounts.find((a) => a.code === code);
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function FixedAssetFormClient({ assetId }: { assetId?: string }) {
  const router = useRouter();
  const editMode = Boolean(assetId);

  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [loading, setLoading] = useState(editMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => (editMode ? "" : todayYmd()));
  const [purchaseCost, setPurchaseCost] = useState("");
  const [salvageValue, setSalvageValue] = useState("0");
  const [usefulLifeYears, setUsefulLifeYears] = useState("5");
  const [depreciationMethod, setDepreciationMethod] = useState<"STRAIGHT_LINE" | "WRITTEN_DOWN_VALUE">(
    "STRAIGHT_LINE",
  );
  const [wdvAnnualPercent, setWdvAnnualPercent] = useState("");
  const [depreciationStartDate, setDepreciationStartDate] = useState(() => (editMode ? "" : todayYmd()));
  const [scheduleFrequency, setScheduleFrequency] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [depreciationExpenseAccountId, setDepreciationExpenseAccountId] = useState("");
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] = useState("");

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ accounts?: AccountOpt[] }>(res, {});
    const list = data.accounts ?? [];
    setAccounts(list);
    return list;
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadAccounts();
      if (!editMode && list.length) {
        setAssetAccountId(findByCode(list, "1500")?.id ?? "");
        setAccumulatedDepreciationAccountId(findByCode(list, "1509")?.id ?? "");
        setDepreciationExpenseAccountId(findByCode(list, "5130")?.id ?? findByCode(list, "5025")?.id ?? "");
      }
    })();
  }, [editMode, loadAccounts]);

  useEffect(() => {
    if (!editMode || !assetId) return;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/accounting/fixed-assets/${assetId}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await parseResponseJson<{ asset?: FixedAssetDto }>(res, {});
      const a = data.asset;
      if (!a) {
        setError("Asset not found.");
        setLoading(false);
        return;
      }
      setName(a.name);
      setAssetCode(a.assetCode);
      setCategory(a.category ?? "");
      setPurchaseDate(ymdFromIso(a.purchaseDate));
      setPurchaseCost(String(a.purchaseCost));
      setSalvageValue(String(a.salvageValue));
      setUsefulLifeYears(String(a.usefulLifeYears));
      setDepreciationMethod(a.depreciationMethod);
      setWdvAnnualPercent(a.wdvAnnualPercent != null ? String(a.wdvAnnualPercent) : "");
      setDepreciationStartDate(ymdFromIso(a.depreciationStartDate));
      setScheduleFrequency(a.scheduleFrequency);
      setAssetAccountId(a.assetAccountId);
      setDepreciationExpenseAccountId(a.depreciationExpenseAccountId);
      setAccumulatedDepreciationAccountId(a.accumulatedDepreciationAccountId);
      setLoading(false);
    })();
  }, [assetId, editMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!assetAccountId || !depreciationExpenseAccountId || !accumulatedDepreciationAccountId) {
      setError("Select all three GL accounts (cost, depreciation expense, accumulated depreciation), or wait for accounts to finish loading.");
      setSaving(false);
      return;
    }
    if (new Set([assetAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId]).size !== 3) {
      setError("The three GL accounts must be different from each other.");
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      assetCode: assetCode.trim(),
      category: category.trim() || null,
      purchaseDate,
      purchaseCost: Number(purchaseCost),
      salvageValue: Number(salvageValue),
      usefulLifeYears: Number(usefulLifeYears),
      depreciationMethod,
      depreciationStartDate,
      scheduleFrequency,
      assetAccountId,
      depreciationExpenseAccountId,
      accumulatedDepreciationAccountId,
    };
    if (depreciationMethod === "WRITTEN_DOWN_VALUE") {
      body.wdvAnnualPercent = wdvAnnualPercent.trim() ? Number(wdvAnnualPercent) : null;
    } else {
      body.wdvAnnualPercent = null;
    }

    const url = editMode ? `/api/accounting/fixed-assets/${assetId}` : "/api/accounting/fixed-assets";
    const res = await fetch(url, {
      method: editMode ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: { error?: string; issues?: unknown; asset?: FixedAssetDto } = {};
    try {
      if (raw.trim()) data = JSON.parse(raw) as typeof data;
    } catch {
      /* non-JSON e.g. HTML error page */
    }
    if (!res.ok) {
      setError(summarizeApiErrorBody(data, { status: res.status, rawBodySnippet: raw.slice(0, 400) }));
      setSaving(false);
      return;
    }
    const id = data.asset?.id ?? assetId;
    router.push(id ? `/dashboard/accounting/fixed-assets/${id}` : "/dashboard/accounting/fixed-assets");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const accountSelect = (value: string, onChange: (v: string) => void) => (
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
    >
      <option value="">Select account</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} — {a.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
        {editMode ? "Edit fixed asset" : "New fixed asset"}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Useful life must be positive; salvage value must stay below cost. WDV needs an annual rate on book value.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset code</label>
            <input
              required
              disabled={editMode}
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm uppercase disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {editMode ? <p className="mt-1 text-xs text-slate-500">Code cannot be changed after creation.</p> : null}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Computers"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Purchase date</label>
            <input
              required
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Purchase cost</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Salvage value</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={salvageValue}
              onChange={(e) => setSalvageValue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Useful life (years)</label>
            <input
              required
              type="number"
              min={1}
              max={200}
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Depreciation method</label>
            <select
              value={depreciationMethod}
              onChange={(e) => setDepreciationMethod(e.target.value as typeof depreciationMethod)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="STRAIGHT_LINE">Straight line (SLM)</option>
              <option value="WRITTEN_DOWN_VALUE">Written down value (WDV)</option>
            </select>
          </div>
          {depreciationMethod === "WRITTEN_DOWN_VALUE" ? (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">WDV annual %</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={wdvAnnualPercent}
                onChange={(e) => setWdvAnnualPercent(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          ) : (
            <div />
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Depreciation start date</label>
            <input
              required
              type="date"
              value={depreciationStartDate}
              onChange={(e) => setDepreciationStartDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Schedule frequency</label>
            <select
              value={scheduleFrequency}
              onChange={(e) => setScheduleFrequency(e.target.value as typeof scheduleFrequency)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">GL accounts</p>
          <p className="mt-1 text-xs text-slate-500">Defaults use 1500 (cost), 1509 (accumulated depreciation), 5130 (expense).</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-1">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset (cost) account</label>
              {accountSelect(assetAccountId, setAssetAccountId)}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Depreciation expense</label>
              {accountSelect(depreciationExpenseAccountId, setDepreciationExpenseAccountId)}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Accumulated depreciation</label>
              {accountSelect(accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            {saving ? "Saving…" : editMode ? "Save changes" : "Create asset"}
          </button>
          <Link
            href={editMode && assetId ? `/dashboard/accounting/fixed-assets/${assetId}` : "/dashboard/accounting/fixed-assets"}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
