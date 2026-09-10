"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RecurringFrequency } from "@prisma/client";
import { CurrencySelect } from "@/components/settings/CurrencySelect";
import { parseResponseJson } from "@/lib/parse-response-json";
import { parseYmd } from "@/lib/dates";
import { advanceRecurringDate } from "@/lib/purchases/recurring-dates";

type Acct = { id: string; code: string; name: string; type: string; isActive?: boolean };
type VendorOpt = { id: string; displayName: string; isActive?: boolean };
type CustomerOpt = { id: string; displayName: string };

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const inputClassFlex =
  "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
const reqClass = "text-red-600 dark:text-red-400";

const FREQ_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "DAILY", label: "Day" },
  { value: "WEEKLY", label: "Week" },
  { value: "MONTHLY", label: "Month" },
  { value: "YEARLY", label: "Year" },
];

function nextScheduledLabel(startYmd: string, freq: RecurringFrequency): string {
  const d = parseYmd(startYmd);
  if (Number.isNaN(d.getTime())) return "";
  const next = advanceRecurringDate(d, freq, 1);
  return `The recurring expense will be created on ${next.toLocaleDateString()}`;
}

export function RecurringExpenseForm({ recurringId }: Readonly<{ recurringId?: string }>) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [form, setForm] = useState({
    frequency: "WEEKLY" as RecurringFrequency,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    neverExpires: true,
    expenseAccountId: "",
    bankAccountId: "",
    currency: "INR",
    amount: "",
    taxAmount: "0",
    vendorId: "",
    vendorLabel: "",
    customerId: "",
    customerLabel: "",
    notes: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!recurringId);

  useEffect(() => {
    void (async () => {
      const [aRes, vRes, cRes] = await Promise.all([
        fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" }),
        fetch("/api/purchases/vendors", { cache: "no-store", credentials: "include" }),
        fetch("/api/customers", { cache: "no-store", credentials: "include" }),
      ]);
      const aData = await parseResponseJson<{ accounts?: Acct[] }>(aRes, {});
      const vData = await parseResponseJson<{ vendors?: VendorOpt[] }>(vRes, {});
      const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
      setAccounts((aData.accounts ?? []).filter((a) => a.isActive !== false));
      setVendors((vData.vendors ?? []).filter((v) => v.isActive !== false));
      setCustomers(cData.customers ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!recurringId) return;
    void (async () => {
      setLoadingEdit(true);
      const res = await fetch(`/api/purchases/recurring-expenses/${recurringId}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await parseResponseJson<{
        recurringExpense?: {
          frequency: RecurringFrequency;
          startDate: string;
          endDate: string;
          expenseAccountId: string;
          bankAccountId: string;
          vendorId: string | null;
          vendorLabel: string;
          customerId: string | null;
          customerLabel: string;
          amount: number;
          taxAmount: number;
          notes: string | null;
          isActive: boolean;
        };
        error?: string;
      }>(res, {});
      setLoadingEdit(false);
      if (!res.ok || !data.recurringExpense) {
        alert(data.error ?? "Could not load template.");
        router.push("/dashboard/purchases/recurring-expenses");
        return;
      }
      const r = data.recurringExpense;
      const end = r.endDate?.trim() ?? "";
      setForm({
        frequency: r.frequency,
        startDate: r.startDate.slice(0, 10),
        endDate: end,
        neverExpires: !end,
        expenseAccountId: r.expenseAccountId,
        bankAccountId: r.bankAccountId,
        currency: "INR",
        amount: String(r.amount),
        taxAmount: String(r.taxAmount ?? 0),
        vendorId: r.vendorId ?? "",
        vendorLabel: r.vendorLabel ?? "",
        customerId: r.customerId ?? "",
        customerLabel: r.customerLabel ?? "",
        notes: r.notes ?? "",
        isActive: r.isActive,
      });
    })();
  }, [recurringId, router]);

  const expenseAccts = accounts.filter((a) => a.type === "EXPENSE");
  const bankAccts = accounts.filter((a) => a.type === "ASSET");

  const scheduleHint = useMemo(
    () => nextScheduledLabel(form.startDate, form.frequency),
    [form.startDate, form.frequency],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.neverExpires && !form.endDate.trim()) {
      alert("Choose an end date or check Never expires.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.neverExpires ? null : form.endDate.trim() || null,
        expenseAccountId: form.expenseAccountId,
        bankAccountId: form.bankAccountId,
        vendorId: form.vendorId.trim() || null,
        customerId: form.customerId.trim() || null,
        amount: Number(form.amount),
        taxAmount: Number(form.taxAmount) || 0,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      };

      const url = recurringId
        ? `/api/purchases/recurring-expenses/${recurringId}`
        : "/api/purchases/recurring-expenses";
      const method = recurringId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await parseResponseJson<{ error?: string }>(res, {});
      if (!res.ok) {
        alert(j.error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/purchases/recurring-expenses");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loadingEdit) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Loading template…
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-6xl px-4 pb-28 pt-2 sm:px-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-slate-50/95 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/purchases/recurring-expenses"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid max-w-3xl gap-5">
        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
          <label className={labelClass}>
            Repeat Every <span className={reqClass}>*</span>
          </label>
          <select
            required
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
            className={inputClass}
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>Start Date</label>
          <div>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className={inputClass}
            />
            {scheduleHint ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{scheduleHint}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>Ends On</label>
          <div>
            <input
              type="date"
              disabled={form.neverExpires}
              value={form.neverExpires ? "" : form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className={`${inputClass} disabled:opacity-50`}
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.neverExpires}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    neverExpires: e.target.checked,
                    endDate: e.target.checked ? "" : f.endDate,
                  }))
                }
              />
              Never expires
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5 dark:border-slate-700" />

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>
            Expense Account <span className={reqClass}>*</span>
          </label>
          <select
            required
            value={form.expenseAccountId}
            onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
            className={inputClass}
          >
            <option value="">Select an account</option>
            {expenseAccts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
          <label className={labelClass}>
            Amount <span className={reqClass}>*</span>
          </label>
          <div className="flex w-full min-w-0 gap-2 sm:max-w-xl">
            <CurrencySelect
              compact
              aria-label="Currency"
              value={form.currency}
              onChange={(code) => setForm((f) => ({ ...f, currency: code }))}
              className={`${inputClassFlex} w-[5.5rem] shrink-0`}
            />
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className={`${inputClassFlex} min-w-[11rem] flex-1 tabular-nums`}
            />
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
          <label className={labelClass}>Tax (GST/VAT)</label>
          <input
            type="number"
            step="0.01"
            value={form.taxAmount}
            onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
            className={`${inputClass} max-w-xs tabular-nums`}
          />
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>
            Paid Through <span className={reqClass}>*</span>
          </label>
          <select
            required
            value={form.bankAccountId}
            onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}
            className={inputClass}
          >
            <option value="">Select an account</option>
            {bankAccts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
          <label className={labelClass}>Vendor</label>
          <div className="flex min-w-0 gap-2">
            <input
              list="vendor-datalist-recurring"
              value={form.vendorLabel}
              onChange={(e) => {
                const val = e.target.value;
                const match = vendors.find((v) => v.displayName === val);
                setForm((f) => ({
                  ...f,
                  vendorLabel: val,
                  vendorId: match?.id ?? "",
                }));
              }}
              placeholder="Search or select vendor"
              className={`${inputClass} min-w-0 flex-1`}
              autoComplete="off"
            />
            <datalist id="vendor-datalist-recurring">
              {vendors.map((v) => (
                <option key={v.id} value={v.displayName} />
              ))}
            </datalist>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-blue-600 p-2.5 text-white shadow hover:bg-blue-700 dark:bg-blue-500"
              aria-label="Open vendors"
              onClick={() => window.open("/dashboard/purchases/vendors", "_blank", "noopener,noreferrer")}
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>Notes</label>
          <textarea
            rows={4}
            maxLength={500}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Max. 500 characters"
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700" />

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
          <label className={labelClass}>Customer Name</label>
          <div className="flex min-w-0 gap-2">
            <input
              list="customer-datalist-recurring"
              value={form.customerLabel}
              onChange={(e) => {
                const val = e.target.value;
                const match = customers.find((c) => c.displayName === val);
                setForm((f) => ({
                  ...f,
                  customerLabel: val,
                  customerId: match?.id ?? "",
                }));
              }}
              placeholder="Search or select customer"
              className={`${inputClass} min-w-0 flex-1`}
              autoComplete="off"
            />
            <datalist id="customer-datalist-recurring">
              {customers.map((c) => (
                <option key={c.id} value={c.displayName} />
              ))}
            </datalist>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-blue-600 p-2.5 text-white shadow hover:bg-blue-700 dark:bg-blue-500"
              aria-label="Open customers"
              onClick={() => window.open("/dashboard/sales/customers", "_blank", "noopener,noreferrer")}
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
          <label className={`${labelClass} pt-2`}>Reporting Tags</label>
          <div className="flex items-center gap-2 pt-1 text-sm">
            <Tag className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
            <button
              type="button"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => alert("Tag associations will be available in a future update.")}
            >
              Associate Tags
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Template active (scheduled runs)
        </label>
      </div>

      <div className="mt-10 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <Link
          href="/dashboard/purchases/recurring-expenses"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
