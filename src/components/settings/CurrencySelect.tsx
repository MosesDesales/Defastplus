"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

export type CurrencyOption = { code: string; symbol: string; name: string };

type Props = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** When set, omits empty option (use for required base currency). */
  required?: boolean;
  /** Narrow select without search (e.g. amount row beside input). */
  compact?: boolean;
  /** Classes for the main select (e.g. appearance-none from form). */
  selectClassName?: string;
  selectStyle?: CSSProperties;
};

function cn(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Loads workspace currencies for selects (customers, vendors, invoices, etc.). */
export function CurrencySelect({
  value,
  onChange,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  required,
  compact,
  selectClassName,
  selectStyle,
}: Props) {
  const [options, setOptions] = useState<CurrencyOption[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/currencies?activeOnly=1", { cache: "no-store", credentials: "include" });
    const data = await parseResponseJson<{ currencies?: { code: string; symbol: string; name: string }[] }>(res, {});
    const list = (data.currencies ?? []).map((c) => ({ code: c.code, symbol: c.symbol, name: c.name }));
    setOptions(list);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) => o.code.toLowerCase().includes(s) || o.name.toLowerCase().includes(s) || o.symbol.toLowerCase().includes(s),
    );
  }, [options, q]);

  const hasValue = options.some((o) => o.code === value);

  if (compact) {
    return (
      <select
        id={id}
        required={required}
        aria-label={ariaLabel ?? "Currency"}
        disabled={disabled}
        style={selectStyle}
        value={hasValue ? value : value ? "__orphan__" : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__orphan__") return;
          onChange(v);
        }}
        className={cn(selectClassName, className)}
      >
        {!hasValue && value ? (
          <option value="__orphan__" disabled>
            {value}
          </option>
        ) : null}
        {!required ? <option value="">—</option> : null}
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex gap-2">
        <input
          type="search"
          placeholder="Search currency…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>
      <select
        id={id}
        required={required}
        aria-label={ariaLabel ?? "Currency"}
        disabled={disabled}
        style={selectStyle}
        value={hasValue ? value : value ? "__orphan__" : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__orphan__") return;
          onChange(v);
        }}
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white",
          selectClassName,
        )}
      >
        {!hasValue && value ? (
          <option value="__orphan__" disabled>
            {value} (not in list — add under Settings → Currencies)
          </option>
        ) : null}
        {!required ? <option value="">Select currency</option> : null}
        {filtered.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} — {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
