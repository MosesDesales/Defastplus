"use client";

import Link from "next/link";
import { HelpCircle, Loader2 } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import { defaultGstSettingsDTO, type GstSettingsDTO } from "@/lib/gst-settings-dto";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";

const REGISTRATION_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Select a registration type…" },
  { value: "REGULAR", label: "Regular — Normal taxpayer" },
  { value: "COMPOSITION", label: "Composition" },
  { value: "CASUAL", label: "Casual taxable person" },
  { value: "ISD", label: "Input Service Distributor (ISD)" },
  { value: "SEZ", label: "SEZ / SEZ Developer" },
  { value: "OVERSEAS", label: "Non-resident taxable person" },
  { value: "UIN", label: "UIN holder" },
];

const labelCol = "text-sm font-medium text-slate-700 dark:text-slate-300 sm:pt-2.5";
const inputCol = "min-w-0";
const field =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/10 focus:border-sky-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const req = "text-red-600 dark:text-red-400";

function Tooltip({ text }: { text: string }) {
  return (
    <span className="ml-1 inline-flex align-middle" title={text}>
      <HelpCircle className="h-4 w-4 text-slate-400" aria-hidden />
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function GstSettingsClient() {
  const [s, setS] = useState<GstSettingsDTO>(() => defaultGstSettingsDTO());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null);
  const [gstinError, setGstinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/gst", { credentials: "include" });
    const data = await parseResponseJson<{ settings?: GstSettingsDTO }>(res, {});
    if (res.ok && data.settings) setS(data.settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function patch<K extends keyof GstSettingsDTO>(key: K, value: GstSettingsDTO[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function lookupTaxpayer() {
    const g = normalizeGstin(s.gstin);
    if (!isValidGstin(g)) {
      setGstinError("Enter a valid 15-character GSTIN first.");
      setToast({ type: "err", message: "Invalid GSTIN" });
      return;
    }
    setGstinError(null);
    setLookupBusy(true);
    const res = await fetch("/api/settings/gst/lookup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gstin: g }),
    });
    const data = await parseResponseJson<{ message?: string; legalName?: string | null; tradeName?: string | null; error?: string }>(
      res,
      {},
    );
    setLookupBusy(false);
    if (!res.ok) {
      setToast({ type: "err", message: data.error ?? "Lookup failed" });
      return;
    }
    if (data.legalName) patch("gstBusinessLegalName", data.legalName);
    if (data.tradeName) patch("gstBusinessTradeName", data.tradeName);
    setToast({ type: "ok", message: data.message ?? "Done" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (s.gstRegistered) {
      const g = normalizeGstin(s.gstin);
      if (!g || !isValidGstin(g)) {
        setGstinError("GSTIN is required (15 characters) when registered for GST.");
        setToast({ type: "err", message: "Check GSTIN and registration type." });
        return;
      }
      if (!s.gstRegistrationType.trim()) {
        setToast({ type: "err", message: "Select a registration type." });
        return;
      }
    }
    setGstinError(null);
    setSaving(true);
    const res = await fetch("/api/settings/gst", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const data = await parseResponseJson<{ message?: string; error?: string; settings?: GstSettingsDTO }>(res, {});
    setSaving(false);
    if (!res.ok) {
      setToast({ type: "err", message: data.error ?? "Could not save" });
      return;
    }
    if (data.settings) setS(data.settings);
    setToast({ type: "ok", message: data.message ?? "GST settings saved" });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {toast ? (
        <div
          role="status"
          className={`fixed left-1/2 top-20 z-[70] w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-8">
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-4 dark:border-sky-900/50 dark:bg-sky-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Is your business registered for GST?</p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.gstRegistered ? "Yes" : "No"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={s.gstRegistered}
                onClick={() => patch("gstRegistered", !s.gstRegistered)}
                className={`relative h-7 w-12 rounded-full transition ${s.gstRegistered ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${s.gstRegistered ? "left-5" : "left-0.5"}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <div className={labelCol}>
              <span className={req}>*</span> GSTIN
              <Tooltip text="15-character Goods & Services Tax Identification Number for India." />
              <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">Maximum 15 characters</p>
            </div>
            <div className={inputCol}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={s.gstin}
                  onChange={(e) => {
                    patch("gstin", e.target.value.toUpperCase());
                    setGstinError(null);
                  }}
                  maxLength={15}
                  disabled={!s.gstRegistered}
                  className={`${field} sm:max-w-md`}
                  placeholder="22AAAAA0000A1Z5"
                  aria-invalid={Boolean(gstinError)}
                />
                <button
                  type="button"
                  disabled={!s.gstRegistered || lookupBusy}
                  onClick={() => void lookupTaxpayer()}
                  className="shrink-0 text-sm font-semibold text-sky-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-sky-400"
                >
                  {lookupBusy ? "…" : null} Get taxpayer details
                </button>
              </div>
              {gstinError ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{gstinError}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>
              Registration type
              {s.gstRegistered ? <span className={req}> *</span> : null}
            </label>
            <div className={inputCol}>
              <select
                value={s.gstRegistrationType}
                onChange={(e) => patch("gstRegistrationType", e.target.value)}
                disabled={!s.gstRegistered}
                className={`${field} sm:max-w-md`}
              >
                {REGISTRATION_TYPES.map((o) => (
                  <option key={o.value || "empty"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>Business legal name</label>
            <div className={inputCol}>
              <input
                value={s.gstBusinessLegalName}
                onChange={(e) => patch("gstBusinessLegalName", e.target.value)}
                disabled={!s.gstRegistered}
                className={field}
                placeholder={s.companyName ? `Default: ${s.companyName}` : "Legal name as per GST registration"}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Pulled from organization profile when empty; you can override for GST filings.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>Business trade name</label>
            <div className={inputCol}>
              <input
                value={s.gstBusinessTradeName}
                onChange={(e) => patch("gstBusinessTradeName", e.target.value)}
                disabled={!s.gstRegistered}
                className={field}
                placeholder="Trade / brand name (optional)"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>GST registered on</label>
            <div className={inputCol}>
              <input
                type="date"
                value={s.gstRegisteredOn}
                onChange={(e) => patch("gstRegisteredOn", e.target.value)}
                disabled={!s.gstRegistered}
                className={`${field} sm:max-w-xs`}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Date format follows your browser locale; stored as calendar date.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <div className={labelCol}>
              <span>Reverse charge</span>
              <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                <Link href="/dashboard/settings/upcoming?k=reverse-charge-help" className="text-sky-700 hover:underline dark:text-sky-400">
                  Know more
                </Link>
              </p>
            </div>
            <div className={inputCol}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={s.gstReverseChargeSales}
                  onChange={(e) => patch("gstReverseChargeSales", e.target.checked)}
                  disabled={!s.gstRegistered}
                  className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">Enable reverse charge in sales transactions</span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>Import / export</label>
            <div className={inputCol}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={s.gstSezOverseasTrading}
                  onChange={(e) => patch("gstSezOverseasTrading", e.target.checked)}
                  disabled={!s.gstRegistered}
                  className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  My business is involved in SEZ / overseas trading
                </span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-x-8">
            <label className={labelCol}>Digital services</label>
            <div className={inputCol}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={s.gstDigitalServicesExport}
                  onChange={(e) => patch("gstDigitalServicesExport", e.target.checked)}
                  disabled={!s.gstRegistered}
                  className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  Track sale of digital services to overseas customers
                </span>
              </label>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Enabling this option lets you record and track export of digital services to individuals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
