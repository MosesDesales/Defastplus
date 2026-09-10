"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrencySelect } from "@/components/settings/CurrencySelect";
import { parseResponseJson } from "@/lib/parse-response-json";

type CurrencyRow = {
  code: string;
  symbol: string;
  name: string;
  isBaseCurrency: boolean;
  exchangeRate: number | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function useDocumentCurrency(initialCurrency = "INR") {
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [currency, setCurrency] = useState(initialCurrency.toUpperCase());
  const [exchangeRate, setExchangeRate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/currencies?activeOnly=1", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ currencies?: CurrencyRow[] }>(res, {});
    const rows = data.currencies ?? [];
    setCurrencies(rows);
    const base = rows.find((c) => c.isBaseCurrency)?.code ?? "INR";
    setBaseCurrency(base);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isForeign = currency.trim().toUpperCase() !== baseCurrency.trim().toUpperCase();

  const catalogRate = useMemo(() => {
    const row = currencies.find((c) => c.code === currency.trim().toUpperCase());
    return row?.exchangeRate ?? null;
  }, [currencies, currency]);

  useEffect(() => {
    if (!isForeign) {
      setExchangeRate("");
      return;
    }
    if (catalogRate != null && !exchangeRate.trim()) {
      setExchangeRate(String(catalogRate));
    }
  }, [isForeign, catalogRate, currency]); // eslint-disable-line react-hooks/exhaustive-deps -- prefill when currency changes

  function applyPartyCurrency(code?: string | null) {
    const next = (code?.trim() || baseCurrency).toUpperCase();
    setCurrency(next);
    const row = currencies.find((c) => c.code === next);
    if (row?.exchangeRate != null && next !== baseCurrency) {
      setExchangeRate(String(row.exchangeRate));
    } else {
      setExchangeRate("");
    }
  }

  function toBaseAmount(foreignTotal: number): number | null {
    if (!Number.isFinite(foreignTotal)) return null;
    if (!isForeign) return round2(foreignTotal);
    const rate = Number.parseFloat(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return round2(foreignTotal * rate);
  }

  function payloadFields() {
    const rate = Number.parseFloat(exchangeRate);
    return {
      currency: currency.trim().toUpperCase(),
      exchangeRate: isForeign && Number.isFinite(rate) && rate > 0 ? rate : null,
    };
  }

  return {
    baseCurrency,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    isForeign,
    catalogRate,
    applyPartyCurrency,
    toBaseAmount,
    payloadFields,
  };
}

export function DocumentCurrencyFields({
  currency,
  onCurrencyChange,
  exchangeRate,
  onExchangeRateChange,
  baseCurrency,
  isForeign,
  catalogRate,
  documentTotal,
  className,
}: Readonly<{
  currency: string;
  onCurrencyChange: (code: string) => void;
  exchangeRate: string;
  onExchangeRateChange: (value: string) => void;
  baseCurrency: string;
  isForeign: boolean;
  catalogRate: number | null;
  documentTotal: number;
  className?: string;
}>) {
  const baseEquivalent = useMemo(() => {
    if (!isForeign) return documentTotal;
    const rate = Number.parseFloat(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return round2(documentTotal * rate);
  }, [documentTotal, exchangeRate, isForeign]);

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Currency</label>
          <CurrencySelect value={currency} onChange={onCurrencyChange} required compact selectClassName={inputClass} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Base currency: <strong>{baseCurrency}</strong>
            {isForeign ? " · amounts below are in the selected currency" : ""}
          </p>
        </div>
        {isForeign ? (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Exchange rate
              <span className="ml-1 font-normal text-slate-500">(1 {currency} → {baseCurrency})</span>
            </label>
            <input
              type="number"
              step="0.000001"
              min={0}
              required
              value={exchangeRate}
              onChange={(e) => onExchangeRateChange(e.target.value)}
              className={inputClass}
            />
            {catalogRate != null ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Catalog rate: {catalogRate}
                {exchangeRate && Number(exchangeRate) !== catalogRate ? " · you can override for this document" : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                No rate in Settings → Currencies. Enter a rate manually or refresh rates there.
              </p>
            )}
          </div>
        ) : null}
      </div>
      {isForeign && baseEquivalent != null ? (
        <p className="mt-3 rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2 text-sm text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
          Document total <strong>{currency} {documentTotal.toFixed(2)}</strong> ≈{" "}
          <strong>{baseCurrency} {baseEquivalent.toFixed(2)}</strong> in base currency
        </p>
      ) : null}
    </div>
  );
}
