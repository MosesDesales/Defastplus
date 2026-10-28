"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  columnOptions,
  mappingErrors,
  parseWithMapping,
  type AmountLayout,
  type DateFormat,
  type MappableField,
  type MappingResult,
  type StatementMapping,
} from "@/lib/banking/statement-mapping";

const selectClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const FIELD_LABEL: Record<MappableField, string> = {
  date: "Date",
  description: "Description",
  description2: "Extra description",
  debit: "Debit (money out)",
  credit: "Credit (money in)",
  amount: "Amount",
  drCr: "Dr / Cr indicator",
  balance: "Balance",
  reference: "Reference / Cheque no.",
};

const BADGE: Partial<Record<MappableField, string>> = {
  date: "Date",
  description: "Description",
  description2: "Description +",
  debit: "Debit",
  credit: "Credit",
  amount: "Amount",
  drCr: "Dr/Cr",
  balance: "Balance",
  reference: "Reference",
};

const LAYOUTS: { value: AmountLayout; label: string; hint: string }[] = [
  { value: "split", label: "Separate Debit & Credit columns", hint: "e.g. Withdrawal Amt. / Deposit Amt." },
  { value: "single", label: "One Amount column (+ / −)", hint: "Negative numbers are money out" },
  { value: "single_drcr", label: "Amount + Dr/Cr column", hint: "e.g. Amount and a DR / CR column" },
];

type Props = {
  table: string[][];
  mapping: StatementMapping;
  onChange: (m: StatementMapping) => void;
  sheetNames: string[] | null;
  sheetIndex: number;
  onSheetChange: (i: number) => void;
  remember: boolean;
  onRememberChange: (v: boolean) => void;
  onContinue: (result: MappingResult) => void;
  busy: boolean;
};

export function StatementColumnMapper({
  table,
  mapping: m,
  onChange,
  sheetNames,
  sheetIndex,
  onSheetChange,
  remember,
  onRememberChange,
  onContinue,
  busy,
}: Props) {
  const [showSkipped, setShowSkipped] = useState(false);
  const options = useMemo(() => columnOptions(table, m.headerRowIndex), [table, m.headerRowIndex]);
  const errors = mappingErrors(m);
  const result = useMemo(() => parseWithMapping(table, m), [table, m]);

  const set = (patch: Partial<StatementMapping>) => onChange({ ...m, ...patch });

  // Which field each column is mapped to (for highlighting the preview grid).
  const usedBy = new Map<number, MappableField[]>();
  const visible: MappableField[] = [
    "date",
    "description",
    "description2",
    ...(m.amountLayout === "split" ? (["debit", "credit"] as const) : (["amount"] as const)),
    ...(m.amountLayout === "single_drcr" ? (["drCr"] as const) : []),
    "balance",
    "reference",
  ];
  for (const f of visible) {
    const c = m[f];
    if (typeof c === "number") usedBy.set(c, [...(usedBy.get(c) ?? []), f]);
  }

  const columnSelect = (field: MappableField, required = false) => {
    const value = m[field];
    const sample = options.find((o) => o.index === value)?.sample;
    return (
      <label key={field} className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {FIELD_LABEL[field]}
          {required ? <span className="text-red-500"> *</span> : <span className="font-normal text-slate-400"> (optional)</span>}
        </span>
        <select
          className={selectClass}
          value={value == null ? "" : String(value)}
          onChange={(e) => set({ [field]: e.target.value === "" ? null : parseInt(e.target.value, 10) } as Partial<StatementMapping>)}
        >
          <option value="">{required ? "Choose a heading…" : "— Not in this file —"}</option>
          {options.map((o) => (
            <option key={o.index} value={o.index}>
              {o.letter} · {o.heading}
            </option>
          ))}
        </select>
        <span className="mt-0.5 block h-4 truncate text-xs text-slate-500" title={sample}>
          {sample ? `e.g. ${sample}` : ""}
        </span>
      </label>
    );
  };

  const headerRowOptions = table.slice(0, 30).map((r, i) => ({
    i,
    text: r.filter((c) => c?.trim()).slice(0, 4).join(" | ").slice(0, 70) || "(blank row)",
  }));
  const previewRows = table.slice(m.headerRowIndex + 1, m.headerRowIndex + 13);
  const previewCols = options.slice(0, 14);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Choose the headings</h3>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          Tell us which column in your statement holds each value. We pre-filled our best guess from the headings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheetNames && sheetNames.length > 1 ? (
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Sheet</span>
            <select className={selectClass} value={sheetIndex} onChange={(e) => onSheetChange(parseInt(e.target.value, 10))}>
              {sheetNames.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">Row with the headings</span>
          <select className={selectClass} value={m.headerRowIndex} onChange={(e) => set({ headerRowIndex: parseInt(e.target.value, 10) })}>
            {headerRowOptions.map((o) => (
              <option key={o.i} value={o.i}>
                Row {o.i + 1}: {o.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {columnSelect("date", true)}
        {columnSelect("description", true)}
        {columnSelect("description2")}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">How does your statement show amounts?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <label
              key={l.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                m.amountLayout === l.value
                  ? "border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/30 dark:bg-teal-950/30"
                  : "border-slate-200 hover:border-teal-300 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="amount-layout"
                className="sr-only"
                checked={m.amountLayout === l.value}
                onChange={() => set({ amountLayout: l.value })}
              />
              <span className="font-medium text-slate-900 dark:text-white">{l.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{l.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {m.amountLayout === "split" ? (
          <>
            {columnSelect("debit")}
            {columnSelect("credit")}
          </>
        ) : (
          columnSelect("amount", true)
        )}
        {m.amountLayout === "single_drcr" ? columnSelect("drCr", true) : null}
        {m.amountLayout === "single" ? (
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Negative amounts are</span>
            <select className={selectClass} value={m.negativeIs} onChange={(e) => set({ negativeIs: e.target.value as "debit" | "credit" })}>
              <option value="debit">Money out (debit)</option>
              <option value="credit">Money in (credit)</option>
            </select>
          </label>
        ) : null}
        {columnSelect("balance")}
        {columnSelect("reference")}
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Date format</span>
          <select className={selectClass} value={m.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormat })}>
            <option value="auto">Automatic (DD/MM/YYYY for India)</option>
            <option value="DMY">DD/MM/YYYY</option>
            <option value="MDY">MM/DD/YYYY</option>
            <option value="YMD">YYYY/MM/DD</option>
          </select>
        </label>
      </div>

      {/* Live result */}
      {errors.length ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errors.join(" ")}</span>
        </div>
      ) : (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            result.rows.length
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {result.rows.length ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
            <span>
              <strong>{result.rows.length}</strong> transaction{result.rows.length === 1 ? "" : "s"} found
              {result.rows.length
                ? ` · ₹${result.rows.reduce((s, r) => s + r.debit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} out · ₹${result.rows
                    .reduce((s, r) => s + r.credit, 0)
                    .toLocaleString("en-IN", { minimumFractionDigits: 2 })} in`
                : " — check the headings above"}
            </span>
            {result.skipped.length ? (
              <button type="button" className="font-medium underline" onClick={() => setShowSkipped((v) => !v)}>
                {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped
              </button>
            ) : null}
          </div>
          {showSkipped && result.skipped.length ? (
            <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs">
              {result.skipped.slice(0, 100).map((s) => (
                <li key={s.row}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Preview grid with the chosen columns highlighted */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900">
              {previewCols.map((o) => {
                const fields = usedBy.get(o.index);
                return (
                  <th
                    key={o.index}
                    className={`border-b border-slate-200 px-2 py-2 align-bottom dark:border-slate-800 ${
                      fields ? "bg-teal-50 dark:bg-teal-950/40" : ""
                    }`}
                  >
                    <span className="block text-[10px] font-normal text-slate-400">{o.letter}</span>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{o.heading}</span>
                    {fields ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {fields.map((f) => (
                          <span key={f} className="rounded bg-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {BADGE[f]}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, ri) => (
              <tr key={ri} className="border-b border-slate-100 dark:border-slate-800">
                {previewCols.map((o) => (
                  <td
                    key={o.index}
                    className={`max-w-[220px] truncate px-2 py-1.5 text-slate-700 dark:text-slate-300 ${
                      usedBy.has(o.index) ? "bg-teal-50/50 dark:bg-teal-950/20" : ""
                    }`}
                    title={r[o.index]}
                  >
                    {r[o.index]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-600"
            checked={remember}
            onChange={(e) => onRememberChange(e.target.checked)}
          />
          Remember these headings for statements with the same layout
        </label>
        <button
          type="button"
          disabled={busy || !!errors.length || !result.rows.length}
          onClick={() => onContinue(result)}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue — review {result.rows.length} transaction{result.rows.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
