"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, ChevronDown, ChevronRight, HelpCircle, Percent, Repeat, Search, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeBillLineAmounts, round2 } from "@/lib/purchases/line-math";
import { parseResponseJson } from "@/lib/parse-response-json";

type VendorOpt = { id: string; displayName: string };
type CustomerOpt = { id: string; displayName: string };
type ItemOpt = { id: string; name: string };
type AcctOpt = { id: string; code: string; name: string; type: string; isActive?: boolean };

type LineRow = {
  itemId: string;
  description: string;
  expenseAccountId: string;
  customerId: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxPercent: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
const reqClass = "text-red-600 dark:text-red-400";

const PAYMENT_TERMS = ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"] as const;

function emptyLine(): LineRow {
  return {
    itemId: "",
    description: "",
    expenseAccountId: "",
    customerId: "",
    quantity: "1",
    rate: "0",
    discountPercent: "0",
    taxPercent: "0",
  };
}

export function RecurringBillForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AcctOpt[]>([]);
  const [liabilityAccounts, setLiabilityAccounts] = useState<AcctOpt[]>([]);
  const [txnOpen, setTxnOpen] = useState(true);
  const [form, setForm] = useState({
    vendorId: "",
    profileName: "",
    frequency: "WEEKLY" as "DAILY" | "WEEKLY" | "MONTHLY",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    neverExpires: true,
    paymentTerms: "DUE_ON_RECEIPT",
    accountsPayableAccountId: "",
    notesInternal: "",
    discountPercent: "0",
    withholdingType: "NONE" as "NONE" | "TDS" | "TCS",
    withholdingAmount: "0",
    adjustmentAmount: "0",
    adjustmentLabel: "Adjustment",
  });
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const loadRefs = useCallback(async () => {
    const [vRes, cRes, iRes, aRes] = await Promise.all([
      fetch("/api/purchases/vendors", { cache: "no-store", credentials: "include" }),
      fetch("/api/customers", { cache: "no-store", credentials: "include" }),
      fetch("/api/inventory/items", { cache: "no-store", credentials: "include" }),
      fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" }),
    ]);
    const vData = await parseResponseJson<{ vendors?: VendorOpt[] }>(vRes, {});
    const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
    const iData = await parseResponseJson<{ items?: ItemOpt[] }>(iRes, {});
    const aData = await parseResponseJson<{ accounts?: AcctOpt[] }>(aRes, {});
    setVendors(vData.vendors ?? []);
    setCustomers(cData.customers ?? []);
    setItems((iData.items ?? []).map((x) => ({ id: x.id, name: x.name })));
    const accts = (aData.accounts ?? []).filter((a) => a.isActive !== false);
    setExpenseAccounts(accts.filter((a) => a.type === "EXPENSE"));
    setLiabilityAccounts(accts.filter((a) => a.type === "LIABILITY"));
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  const totals = useMemo(() => {
    const docPct = Number(form.discountPercent) || 0;
    const docFactor = Math.max(0, 1 - docPct / 100);
    let rawSum = 0;
    let net = 0;
    let tax = 0;
    let lineSum = 0;
    for (const l of lines) {
      const qty = Number(l.quantity);
      const rate = Number(l.rate);
      const dp = Number(l.discountPercent) || 0;
      const tp = Number(l.taxPercent) || 0;
      const rawTotal = Number(computeBillLineAmounts(qty, rate, dp, tp).lineTotal);
      rawSum += rawTotal;
      const scaled = computeBillLineAmounts(qty, rate * docFactor, dp, tp);
      net += Number(scaled.lineNet);
      tax += Number(scaled.lineTax);
      lineSum += Number(scaled.lineTotal);
    }
    const adj = Number(form.adjustmentAmount) || 0;
    const wh = Number(form.withholdingAmount) || 0;
    const grand = round2(lineSum + adj - wh);
    const docDiscAmt = round2(rawSum - lineSum);
    return { net, tax, lineSum, grand, docDiscAmt };
  }, [lines, form.adjustmentAmount, form.withholdingAmount, form.discountPercent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) {
      alert("Select a vendor.");
      return;
    }
    if (!form.profileName.trim()) {
      alert("Enter a profile name.");
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      alert("Add at least one line with item details.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases/recurring-bills", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          profileName: form.profileName.trim(),
          frequency: form.frequency,
          startDate: form.startDate,
          endDate: form.neverExpires ? null : form.endDate.trim() || null,
          isActive: true,
          paymentTerms: form.paymentTerms,
          accountsPayableAccountId: form.accountsPayableAccountId.trim() || null,
          notesInternal: form.notesInternal.trim() || null,
          discountPercent: Number(form.discountPercent) || 0,
          withholdingType: form.withholdingType,
          withholdingAmount: Number(form.withholdingAmount) || 0,
          adjustmentAmount: Number(form.adjustmentAmount) || 0,
          lines: validLines.map((l, i) => ({
            itemId: l.itemId.trim() || null,
            customerId: l.customerId.trim() || null,
            description: l.description.trim(),
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            discountPercent: Number(l.discountPercent) || 0,
            taxPercent: Number(l.taxPercent) || 0,
            expenseAccountId: l.expenseAccountId.trim() || null,
            sortOrder: i,
          })),
        }),
      });
      const j = await parseResponseJson<{ error?: string }>(res, {});
      if (!res.ok) {
        alert(j.error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/purchases/recurring-bills");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} className="mx-auto max-w-6xl pb-28 pt-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
        <div className="flex items-center gap-2">
          <Repeat className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">New Recurring Bill</h1>
        </div>
        <Link
          href="/dashboard/purchases/recurring-bills"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          Close
        </Link>
      </div>

      <div className="mt-6 space-y-8 px-4 sm:px-6">
        <div className="grid max-w-4xl gap-5">
          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Vendor Name <span className={reqClass}>*</span>
            </label>
            <div className="flex gap-2">
              <select
                required
                value={form.vendorId}
                onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select a Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-blue-600 p-2.5 text-white hover:bg-blue-700"
                aria-label="Search vendors"
                onClick={() => window.open("/dashboard/purchases/vendors", "_blank", "noopener,noreferrer")}
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Profile Name <span className={reqClass}>*</span>
            </label>
            <input
              required
              value={form.profileName}
              onChange={(e) => setForm((f) => ({ ...f, profileName: e.target.value }))}
              className={inputClass}
              placeholder=""
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Repeat Every <span className={reqClass}>*</span>
            </label>
            <select
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as typeof form.frequency }))}
              className={inputClass}
            >
              <option value="DAILY">Day</option>
              <option value="WEEKLY">Week</option>
              <option value="MONTHLY">Month</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end">
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center lg:col-span-1">
              <label className={labelClass}>Start On</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="hidden text-center text-sm text-slate-500 lg:block pb-2">Ends On</div>
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
              <label className={`${labelClass} lg:hidden`}>Ends On</label>
              <input
                type="date"
                disabled={form.neverExpires}
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={`${inputClass} disabled:opacity-50`}
                placeholder="dd/MM/yyyy"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.neverExpires}
                onChange={(e) => setForm((f) => ({ ...f, neverExpires: e.target.checked, endDate: e.target.checked ? "" : f.endDate }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Never Expires
            </label>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={`${labelClass} inline-flex items-center gap-1`}>
              Accounts Payable
              <button type="button" className="text-slate-400 hover:text-slate-600" title="Liability account for generated bills" aria-label="Help">
                <HelpCircle className="h-4 w-4" />
              </button>
            </label>
            <select
              value={form.accountsPayableAccountId}
              onChange={(e) => setForm((f) => ({ ...f, accountsPayableAccountId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Accounts Payable</option>
              {liabilityAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>Payment Terms</label>
            <select value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} className={inputClass}>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTxnOpen((o) => !o)}
            className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-slate-800 hover:text-slate-950 dark:text-slate-200"
          >
            <Percent className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            At Transaction Level
            {txnOpen ? <ChevronDown className="ml-auto h-4 w-4 text-slate-400" /> : <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />}
          </button>

          {txnOpen ? (
            <div className="space-y-6 pt-4">
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Item Table</span>
                  <button type="button" className="inline-flex items-center gap-1 text-sm text-slate-400" disabled title="Coming soon">
                    Bulk Actions ✓
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                      <tr>
                        <th className="px-3 py-2">Item details</th>
                        <th className="w-40 px-3 py-2">Account</th>
                        <th className="w-24 px-3 py-2 text-right">Quantity</th>
                        <th className="w-28 px-3 py-2 text-right">Rate</th>
                        <th className="w-24 px-3 py-2 text-right">Discount %</th>
                        <th className="w-20 px-3 py-2 text-right">Tax %</th>
                        <th className="w-36 px-3 py-2">Customer details</th>
                        <th className="w-28 px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => {
                        const docFactor = Math.max(0, 1 - (Number(form.discountPercent) || 0) / 100);
                        const qty = Number(line.quantity);
                        const rate = Number(line.rate) * docFactor;
                        const dp = Number(line.discountPercent) || 0;
                        const tp = Number(line.taxPercent) || 0;
                        const { lineTotal } = computeBillLineAmounts(qty, rate, dp, tp);
                        const amt = Number(lineTotal);
                        return (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 align-top">
                              <input
                                list={`rb-items-${i}`}
                                value={line.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const m = items.find((it) => it.name === val);
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, description: val, itemId: m?.id ?? "" };
                                    return next;
                                  });
                                }}
                                placeholder="Type or click to select an item"
                                className={inputClass}
                              />
                              <datalist id={`rb-items-${i}`}>
                                {items.map((it) => (
                                  <option key={it.id} value={it.name} />
                                ))}
                              </datalist>
                              <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400" disabled>
                                <Tag className="h-3.5 w-3.5" /> Reporting Tags ▾
                              </button>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.expenseAccountId}
                                onChange={(e) => {
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, expenseAccountId: e.target.value };
                                    return next;
                                  });
                                }}
                                className={inputClass}
                              >
                                <option value="">Select an account</option>
                                {expenseAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} — {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                step="0.01"
                                value={line.quantity}
                                onChange={(e) => {
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, quantity: e.target.value };
                                    return next;
                                  });
                                }}
                                className={`${inputClass} text-right tabular-nums`}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="relative">
                                <Calculator className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.rate}
                                  onChange={(e) => {
                                    setLines((rows) => {
                                      const next = [...rows];
                                      next[i] = { ...next[i]!, rate: e.target.value };
                                      return next;
                                    });
                                  }}
                                  className={`${inputClass} pl-8 text-right tabular-nums`}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={line.discountPercent}
                                onChange={(e) => {
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, discountPercent: e.target.value };
                                    return next;
                                  });
                                }}
                                className={`${inputClass} text-right tabular-nums`}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={line.taxPercent}
                                onChange={(e) => {
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, taxPercent: e.target.value };
                                    return next;
                                  });
                                }}
                                className={`${inputClass} text-right tabular-nums`}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={line.customerId}
                                onChange={(e) => {
                                  setLines((rows) => {
                                    const next = [...rows];
                                    next[i] = { ...next[i]!, customerId: e.target.value };
                                    return next;
                                  });
                                }}
                                className={inputClass}
                              >
                                <option value="">Select Customer</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.displayName}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top text-right tabular-nums font-semibold text-slate-900 dark:text-white">{amt.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                  <button type="button" className="text-sm text-slate-400" disabled>
                    Reporting Tags ▾
                  </button>
                  <button
                    type="button"
                    onClick={() => setLines((rows) => [...rows, emptyLine()])}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    + Add New Row ▾
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-sm dark:border-slate-700">
                    <span>Sub Total</span>
                    <span className="tabular-nums">{totals.net.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-sm dark:border-slate-700">
                    <span>Tax (lines)</span>
                    <span className="tabular-nums">{totals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-3 text-sm dark:border-slate-700">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={form.discountPercent}
                        onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                    <span className="tabular-nums text-slate-600">{totals.docDiscAmt.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2 border-b border-slate-200 py-3 dark:border-slate-700">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">TDS / TCS</span>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="wh"
                          checked={form.withholdingType === "TDS"}
                          onChange={() => setForm((f) => ({ ...f, withholdingType: "TDS" }))}
                        />
                        TDS
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="wh"
                          checked={form.withholdingType === "TCS"}
                          onChange={() => setForm((f) => ({ ...f, withholdingType: "TCS" }))}
                        />
                        TCS
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="wh"
                          checked={form.withholdingType === "NONE"}
                          onChange={() => setForm((f) => ({ ...f, withholdingType: "NONE" }))}
                        />
                        None
                      </label>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Withholding</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.withholdingAmount}
                        onChange={(e) => setForm((f) => ({ ...f, withholdingAmount: e.target.value }))}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
                      />
                    </div>
                    <p className="text-right text-xs tabular-nums text-slate-500">
                      −{(Number(form.withholdingAmount) || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-300 py-2 text-sm dark:border-slate-600">
                    <input
                      type="text"
                      value={form.adjustmentLabel}
                      onChange={(e) => setForm((f) => ({ ...f, adjustmentLabel: e.target.value }))}
                      className="max-w-[120px] rounded border border-transparent bg-transparent px-1 font-medium outline-none focus:border-slate-300 dark:focus:border-slate-600"
                    />
                    <button type="button" className="text-slate-400" aria-label="Help" title="Optional adjustment">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={form.adjustmentAmount}
                      onChange={(e) => setForm((f) => ({ ...f, adjustmentAmount: e.target.value }))}
                      className="ml-auto w-28 rounded border border-dashed border-slate-300 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex justify-between gap-4 pt-3 text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{totals.grand.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block">
            <span className={`${labelClass} font-semibold text-slate-900 dark:text-white`}>Notes</span>
            <textarea
              rows={5}
              value={form.notesInternal}
              onChange={(e) => setForm((f) => ({ ...f, notesInternal: e.target.value }))}
              className={`${inputClass} mt-2 resize-y`}
            />
            <p className="mt-1 text-xs text-slate-500">It will not be shown in PDF</p>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-8 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href="/dashboard/purchases/recurring-bills"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
