"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CURRENCY_CODE_OPTIONS, templateForCode } from "@/lib/currencies/defaults";
import { summarizeApiErrorBody } from "@/lib/api-error-message";
import type { CurrencyDto } from "@/lib/currencies/dto";
import { parseResponseJson } from "@/lib/parse-response-json";

const FORMAT_PRESETS = [
  { value: "en-IN", label: "India — ₹ 1,00,000.00 style" },
  { value: "en-US", label: "US — $100,000.00 style" },
  { value: "de-DE", label: "Europe — €100.000,00 style" },
  { value: "en-GB", label: "UK — £100,000.00 style" },
  { value: "en-AU", label: "Australia" },
  { value: "ja-JP", label: "Japan (0 decimals typical)" },
  { value: "ar-SA", label: "Arabic locale" },
];

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function CurrenciesSettingsClient() {
  const [rows, setRows] = useState<CurrencyDto[]>([]);
  const [feedsEnabled, setFeedsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [codePick, setCodePick] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState("2");
  const [formatLocale, setFormatLocale] = useState("en-IN");
  const [rate, setRate] = useState("");
  const [isBase, setIsBase] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/currencies", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ currencies?: CurrencyDto[]; exchangeRateFeedsEnabled?: boolean }>(res, {});
    setRows(data.currencies ?? []);
    setFeedsEnabled(Boolean(data.exchangeRateFeedsEnabled));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const codeChoices = useMemo(() => {
    const f = codeFilter.trim().toLowerCase();
    const base = CURRENCY_CODE_OPTIONS.filter((c) => !f || c.code.toLowerCase().includes(f) || c.name.toLowerCase().includes(f));
    return base.slice(0, 40);
  }, [codeFilter]);

  function openCreate() {
    setModal("create");
    setEditId(null);
    setCodePick("");
    setCodeFilter("");
    setSymbol("");
    setName("");
    setDecimals("2");
    setFormatLocale("en-IN");
    setRate("");
    setIsBase(false);
  }

  function openEdit(r: CurrencyDto) {
    setModal("edit");
    setEditId(r.id);
    setCodePick(r.code);
    setSymbol(r.symbol);
    setName(r.name);
    setDecimals(String(r.decimalPlaces));
    setFormatLocale(r.formatLocale);
    setRate(r.exchangeRate != null ? String(r.exchangeRate) : "");
    setIsBase(r.isBaseCurrency);
  }

  function fillFromTemplate(code: string) {
    const c = code.trim().toUpperCase();
    setCodePick(c);
    const t = templateForCode(c);
    if (t) {
      setSymbol(t.symbol);
      setName(t.name);
      setDecimals(String(t.decimalPlaces));
      setFormatLocale(t.formatLocale);
    }
  }

  async function saveModal() {
    setSaving(true);
    setMsg(null);
    const code = codePick.trim().toUpperCase();
    if (!/^[A-Z]{2,8}$/.test(code)) {
      setMsg({ type: "err", text: "Enter a valid currency code (2–8 letters)." });
      setSaving(false);
      return;
    }
    if (!symbol.trim() || !name.trim()) {
      setMsg({ type: "err", text: "Symbol and name are required." });
      setSaving(false);
      return;
    }

    if (isBase && modal === "edit") {
      const prev = rows.find((r) => r.isBaseCurrency);
      if (prev && prev.code !== code) {
        const ok = window.confirm(
          "Changing base currency may affect reports and how historical amounts are interpreted. Continue?",
        );
        if (!ok) {
          setSaving(false);
          return;
        }
      }
    }
    if (isBase && modal === "create") {
      const ok = window.confirm(
        "This will set the organization base currency and update the company profile. Reports may be affected. Continue?",
      );
      if (!ok) {
        setSaving(false);
        return;
      }
    }

    const body: Record<string, unknown> = {
      code,
      symbol: symbol.trim(),
      name: name.trim(),
      decimalPlaces: parseInt(decimals, 10) || 0,
      formatLocale: formatLocale.trim(),
      isBaseCurrency: isBase,
      isActive: true,
    };
    if (!isBase && rate.trim()) {
      const n = Number(rate);
      if (Number.isFinite(n) && n > 0) body.exchangeRate = n;
    } else if (!isBase) {
      body.exchangeRate = null;
    }

    const url = modal === "edit" && editId ? `/api/settings/currencies/${editId}` : "/api/settings/currencies";
    const res = await fetch(url, {
      method: modal === "edit" ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: unknown = {};
    try {
      if (raw.trim()) data = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      setMsg({ type: "err", text: summarizeApiErrorBody(data, { status: res.status, rawBodySnippet: raw }) });
      setSaving(false);
      return;
    }
    setModal(null);
    setSaving(false);
    setMsg({ type: "ok", text: modal === "edit" ? "Currency updated." : "Currency added." });
    await load();
  }

  async function toggleFeeds(next: boolean) {
    const res = await fetch("/api/settings/currencies/feeds", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchangeRateFeedsEnabled: next }),
    });
    if (!res.ok) {
      setMsg({ type: "err", text: "Could not update feeds setting." });
      return;
    }
    setFeedsEnabled(next);
    setMsg({ type: "ok", text: next ? "Exchange rate feeds enabled (use Refresh to pull rates)." : "Feeds disabled." });
  }

  async function refreshRates() {
    setMsg(null);
    const res = await fetch("/api/settings/currencies/refresh-rates", { method: "POST", credentials: "include" });
    const data = await parseResponseJson<{ updated?: number; skipped?: string[]; warning?: string }>(res, {});
    if (!res.ok) {
      setMsg({ type: "err", text: "Refresh failed." });
      return;
    }
    const w = data.warning ? ` (${data.warning})` : "";
    setMsg({
      type: "ok",
      text: `Updated ${data.updated ?? 0} currencies.${data.skipped?.length ? ` Skipped: ${data.skipped.slice(0, 8).join(", ")}${data.skipped.length > 8 ? "…" : ""}.` : ""}${w}`,
    });
    await load();
  }

  async function setActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/settings/currencies/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      setMsg({ type: "err", text: "Could not update status." });
      return;
    }
    await load();
  }

  async function setAsBase(r: CurrencyDto) {
    const ok = window.confirm(
      "Changing base currency may affect reports. The company profile base currency will be updated. Continue?",
    );
    if (!ok) return;
    const res = await fetch(`/api/settings/currencies/${r.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBaseCurrency: true }),
    });
    if (!res.ok) {
      setMsg({ type: "err", text: "Could not change base currency." });
      return;
    }
    setMsg({ type: "ok", text: `Base currency is now ${r.code}.` });
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Settings</p>
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Currencies</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Manage symbols, decimal places, and exchange rates vs your base currency. These codes appear everywhere you record money —{" "}
            <Link href="/settings/profile#settings-currency" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
              organization profile
            </Link>
            , customers, vendors, bills, and more.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            + New Currency
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <input type="checkbox" checked={feedsEnabled} onChange={(e) => void toggleFeeds(e.target.checked)} />
            Exchange rate feeds
          </label>
          <button
            type="button"
            onClick={() => void refreshRates()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            Refresh rates
          </button>
        </div>
      </div>

      {msg ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"}`}
        >
          {msg.text}
        </p>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Currency</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Symbol</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Decimals</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Format</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Rate → base</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
                        {r.isBaseCurrency ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Base
                          </span>
                        ) : null}
                        {!r.isActive ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3">{r.symbol}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.decimalPlaces}</td>
                    <td className="max-w-[200px] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{r.formatPreview}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {r.isBaseCurrency ? "—" : r.exchangeRate != null ? r.exchangeRate.toFixed(6) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.rateUpdatedAt ? new Date(r.rateUpdatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <details className="relative inline-block text-left">
                        <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                          ⋮
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          {!r.isBaseCurrency ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => void setAsBase(r)}
                            >
                              Set as base
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => void setActive(r.id, !r.isActive)}
                          >
                            {r.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <Modal title={modal === "edit" ? "Edit currency" : "New currency"} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Currency code *</label>
              <input
                value={codePick}
                onChange={(e) =>
                  setCodePick(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8))
                }
                disabled={modal === "edit"}
                placeholder="USD"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {modal === "create" ? (
                <>
                  <input
                    type="search"
                    placeholder="Search ISO codes…"
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
                    {codeChoices.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => fillFromTemplate(c.code)}
                        className="block w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {c.code} — {c.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Symbol *</span>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Decimal places</span>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Format locale</span>
                <select
                  value={formatLocale}
                  onChange={(e) => setFormatLocale(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {FORMAT_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!isBase ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Exchange rate (× to base)</span>
                <input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Manual or use Refresh rates"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">Multiply an amount in this currency by this factor to express it in base currency.</p>
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input type="checkbox" checked={isBase} onChange={(e) => setIsBase(e.target.checked)} />
              Base currency
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveModal()}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
