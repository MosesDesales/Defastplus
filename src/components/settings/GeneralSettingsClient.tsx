"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, RotateCcw, Search } from "lucide-react";
import {
  applyModuleDependencies,
  type OrganizationModuleSettingsDTO,
} from "@/lib/organization-module-settings";
import { useOrganizationModuleSettings } from "@/components/organization-module-settings-context";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type RowDef = {
  key: keyof OrganizationModuleSettingsDTO;
  label: string;
  hint?: string;
  /** When false, row is disabled (greyed) because parent inventory is off. */
  inventoryChild?: boolean;
};

type GroupDef = { id: string; title: string; rows: RowDef[] };

const GROUPS: GroupDef[] = [
  {
    id: "sales",
    title: "Sales",
    rows: [
      { key: "quotesEnabled", label: "Quotes", hint: "Estimates and quotations before you invoice." },
      { key: "deliveryChallanEnabled", label: "Delivery challans", hint: "Ship with a delivery note separate from the tax invoice." },
      { key: "recurringInvoiceEnabled", label: "Recurring invoices", hint: "Subscription-style billing on a schedule." },
      { key: "creditNoteEnabled", label: "Credit notes", hint: "Reduce or refund amounts already invoiced." },
      { key: "paymentLinksEnabled", label: "Payment links", hint: "Share a link so customers can pay online." },
    ],
  },
  {
    id: "purchases",
    title: "Purchases",
    rows: [
      { key: "purchaseOrderEnabled", label: "Purchase orders", hint: "Formal orders before bills arrive." },
      { key: "recurringExpenseEnabled", label: "Recurring expenses", hint: "Automate repeating spend." },
      { key: "recurringBillsEnabled", label: "Recurring bills", hint: "Vendor invoices that repeat on a cadence." },
      { key: "vendorCreditEnabled", label: "Vendor credits", hint: "Track refunds and adjustments from suppliers." },
    ],
  },
  {
    id: "accounting",
    title: "Accounting",
    rows: [
      { key: "manualJournalEnabled", label: "Manual journals", hint: "Double-entry journals you create and post." },
      { key: "recurringJournalEnabled", label: "Recurring journals", hint: "Scheduled or templated journal postings." },
      { key: "fixedAssetsEnabled", label: "Fixed assets", hint: "Asset register, depreciation, and disposals." },
    ],
  },
  {
    id: "productivity",
    title: "Productivity",
    rows: [
      { key: "timeTrackingEnabled", label: "Time tracking", hint: "Log hours before billing them." },
      { key: "tasksEnabled", label: "Tasks", hint: "Lightweight work tracking across the team." },
    ],
  },
  {
    id: "hr",
    title: "HR & payroll",
    rows: [{ key: "payrollEnabled", label: "Payroll", hint: "Salary structures, runs, and payslips." }],
  },
  {
    id: "inventory",
    title: "Inventory",
    rows: [
      { key: "inventoryEnabled", label: "Inventory tracking", hint: "Master switch for stock, warehouses, and valuation." },
      {
        key: "warehousesEnabled",
        label: "Warehouses",
        hint: "Multiple storage locations and stock by location.",
        inventoryChild: true,
      },
      {
        key: "batchTrackingEnabled",
        label: "Batch tracking",
        hint: "Track lots and batches on stock moves.",
        inventoryChild: true,
      },
      {
        key: "serialTrackingEnabled",
        label: "Serial number tracking",
        hint: "Unique identifiers per unit.",
        inventoryChild: true,
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    rows: [
      { key: "ocrEnabled", label: "OCR", hint: "Upload scans for automated data extraction." },
      { key: "tallyEnabled", label: "Tally integration", hint: "Sync with Tally." },
      { key: "zohoBooksEnabled", label: "Zoho Books integration", hint: "Connect Zoho Books." },
      { key: "quickbooksEnabled", label: "QuickBooks integration", hint: "Connect QuickBooks Online." },
    ],
  },
];

export function GeneralSettingsClient() {
  const { settings, loaded, canManage, refresh } = useOrganizationModuleSettings();
  const [draft, setDraft] = useState<OrganizationModuleSettingsDTO | null>(null);
  const draftInitRef = useRef(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null);

  useEffect(() => {
    if (!loaded || draftInitRef.current) return;
    setDraft({ ...settings });
    draftInitRef.current = true;
  }, [loaded, settings]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const setKey = useCallback((key: keyof OrganizationModuleSettingsDTO, value: boolean) => {
    setDraft((d) => {
      if (!d) return d;
      const next: OrganizationModuleSettingsDTO = { ...d, [key]: value };
      if (key === "inventoryEnabled" && !value) {
        next.warehousesEnabled = false;
        next.batchTrackingEnabled = false;
        next.serialTrackingEnabled = false;
      }
      return applyModuleDependencies(next);
    });
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      rows: g.rows.filter((r) => r.label.toLowerCase().includes(q) || (r.hint && r.hint.toLowerCase().includes(q))),
    })).filter((g) => g.rows.length > 0);
  }, [query]);

  const save = useCallback(async () => {
    if (!draft || !canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast({ type: "err", message: j.error ?? "Could not save settings" });
        return;
      }
      const json = (await res.json()) as { settings: OrganizationModuleSettingsDTO };
      setDraft(json.settings);
      await refresh();
      setToast({ type: "ok", message: "Settings updated successfully" });
    } finally {
      setSaving(false);
    }
  }, [draft, canManage, refresh]);

  const restoreDefaults = useCallback(async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreDefaults: true }),
      });
      if (!res.ok) {
        setToast({ type: "err", message: "Could not restore defaults" });
        return;
      }
      const json = (await res.json()) as { settings: OrganizationModuleSettingsDTO };
      setDraft(json.settings);
      await refresh();
      setToast({ type: "ok", message: "Defaults restored — all modules enabled." });
    } finally {
      setSaving(false);
    }
  }, [canManage, refresh]);

  if (!loaded || !draft) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse space-y-4 py-10">
        <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-900" />
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12 transition-opacity duration-300">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Setup & configurations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">General</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Select the modules you would like to enable.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-teal-500/0 transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void restoreDefaults()}
            disabled={!canManage || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Restore defaults
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canManage || saving}
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          You can view these preferences, but only an organization administrator can change them.
        </p>
      ) : null}

      {toast ? (
        <div
          role="status"
          className={cx(
            "fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg motion-safe:transition-opacity",
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-100",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-6">
        {filteredGroups.map((group) => (
          <section
            key={group.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">{group.title}</h2>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.rows.map((row) => {
                const on = Boolean(draft[row.key]);
                const invLocked = row.inventoryChild && !draft.inventoryEnabled;
                const disabled = !canManage || invLocked;
                return (
                  <li
                    key={row.key}
                    className={cx(
                      "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                      disabled && "opacity-60",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{row.label}</span>
                        {row.hint ? (
                          <span className="group relative inline-flex shrink-0" title={row.hint}>
                            <Info className="h-4 w-4 cursor-help text-slate-400" aria-hidden />
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 dark:bg-slate-700">
                              {row.hint}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      {invLocked ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn on inventory tracking to use this option.</p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={(e) => setKey(row.key, e.target.checked)}
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-teal-600 transition focus:ring-teal-500/30 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-teal-500"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">No modules match your search.</p>
      ) : null}
    </div>
  );
}
