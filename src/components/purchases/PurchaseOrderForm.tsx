"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Calculator, Search, Settings, ShoppingBag, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentCurrencyFields, useDocumentCurrency } from "@/components/DocumentCurrencyFields";
import { computeLineAmounts, round2 } from "@/lib/purchases/line-math";
import { parseResponseJson } from "@/lib/parse-response-json";

type VendorOpt = { id: string; displayName: string; currency?: string | null };
type CustomerOpt = {
  id: string;
  displayName: string;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  billingCountry?: string | null;
};
type ItemOpt = { id: string; name: string };
type AcctOpt = { id: string; code: string; name: string; type: string };

type LineRow = {
  itemId: string;
  description: string;
  expenseAccountId: string;
  quantity: string;
  rate: string;
  taxPercent: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
const reqClass = "text-red-600 dark:text-red-400";

const PAYMENT_TERMS = ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"] as const;

function formatCustomerAddress(c: CustomerOpt) {
  const line = [c.billingStreet, [c.billingCity, c.billingState, c.billingZip].filter(Boolean).join(", "), c.billingCountry]
    .filter(Boolean)
    .join("\n");
  return [c.displayName, line].filter(Boolean).join("\n");
}

function emptyLine(): LineRow {
  return { itemId: "", description: "", expenseAccountId: "", quantity: "1", rate: "0", taxPercent: "0" };
}

export function PurchaseOrderForm() {
  const router = useRouter();
  const saveIntent = useRef<"draft" | "send">("draft");
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AcctOpt[]>([]);
  const [form, setForm] = useState({
    vendorId: "",
    deliveryMode: "ORGANIZATION" as "ORGANIZATION" | "CUSTOMER",
    deliveryCustomerId: "",
    deliverySnapshot: "",
    poNumber: "",
    reference: "",
    poDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    paymentTerms: "DUE_ON_RECEIPT",
    shipmentPreference: "",
    memo: "",
    termsAndConditions: "",
    discountPercent: "0",
    adjustmentAmount: "0",
    withholdingType: "NONE" as "NONE" | "TDS" | "TCS",
    withholdingAmount: "0",
    pdfTemplate: "Standard Template",
  });
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const fx = useDocumentCurrency("INR");

  const loadRefs = useCallback(async () => {
    const [vRes, cRes, iRes, aRes, poRes] = await Promise.all([
      fetch("/api/purchases/vendors", { cache: "no-store", credentials: "include" }),
      fetch("/api/customers", { cache: "no-store", credentials: "include" }),
      fetch("/api/inventory/items", { cache: "no-store", credentials: "include" }),
      fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" }),
      fetch("/api/purchases/purchase-orders", { cache: "no-store", credentials: "include" }),
    ]);
    const vData = await parseResponseJson<{ vendors?: VendorOpt[] }>(vRes, {});
    const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
    const iData = await parseResponseJson<{ items?: ItemOpt[] }>(iRes, {});
    const aData = await parseResponseJson<{ accounts?: AcctOpt[] }>(aRes, {});
    const poData = await parseResponseJson<{ purchaseOrders?: { poNumber: string }[] }>(poRes, {});
    setVendors(vData.vendors ?? []);
    setCustomers(cData.customers ?? []);
    setItems((iData.items ?? []).map((x) => ({ id: x.id, name: x.name })));
    setExpenseAccounts((aData.accounts ?? []).filter((a) => a.type === "EXPENSE"));
    const n = (poData.purchaseOrders ?? []).length;
    setForm((f) => ({
      ...f,
      poNumber: f.poNumber || `PO-${String(n + 1).padStart(5, "0")}`,
    }));
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === form.vendorId) ?? null,
    [vendors, form.vendorId],
  );

  useEffect(() => {
    if (selectedVendor?.currency) fx.applyPartyCurrency(selectedVendor.currency);
  }, [selectedVendor?.id, selectedVendor?.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (form.deliveryMode !== "CUSTOMER" || !form.deliveryCustomerId) return;
    const c = customers.find((x) => x.id === form.deliveryCustomerId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      deliverySnapshot: f.deliverySnapshot.trim() ? f.deliverySnapshot : formatCustomerAddress(c),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh snapshot when customer changes
  }, [form.deliveryCustomerId, form.deliveryMode, customers]);

  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    for (const l of lines) {
      const qty = Number(l.quantity);
      const rate = Number(l.rate);
      const tp = Number(l.taxPercent) || 0;
      const { lineNet, lineTax } = computeLineAmounts(qty, rate, tp);
      net += Number(lineNet);
      tax += Number(lineTax);
    }
    const dp = Number(form.discountPercent) || 0;
    const discountAmt = round2(net * (dp / 100));
    const netAfterDisc = round2(net - discountAmt);
    const adj = Number(form.adjustmentAmount) || 0;
    const wh = Number(form.withholdingAmount) || 0;
    const grand = round2(netAfterDisc + tax + adj - wh);
    return { net, tax, discountAmt, grand };
  }, [lines, form.discountPercent, form.adjustmentAmount, form.withholdingAmount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) {
      alert("Select a vendor.");
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      alert("Add at least one line with a description.");
      return;
    }
    setSaving(true);
    try {
      const status = saveIntent.current === "send" ? "SENT" : "DRAFT";
      const res = await fetch("/api/purchases/purchase-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          ...fx.payloadFields(),
          poNumber: form.poNumber.trim() || null,
          reference: form.reference.trim() || null,
          poDate: form.poDate,
          expectedDate: form.expectedDate.trim() || null,
          memo: form.memo.trim() || null,
          status,
          deliveryMode: form.deliveryMode,
          deliveryCustomerId: form.deliveryMode === "CUSTOMER" ? form.deliveryCustomerId || null : null,
          deliverySnapshot: form.deliverySnapshot.trim() || null,
          paymentTerms: form.paymentTerms,
          shipmentPreference: form.shipmentPreference.trim() || null,
          termsAndConditions: form.termsAndConditions.trim() || null,
          discountPercent: Number(form.discountPercent) || 0,
          adjustmentAmount: Number(form.adjustmentAmount) || 0,
          withholdingType: form.withholdingType,
          withholdingAmount: Number(form.withholdingAmount) || 0,
          pdfTemplate: form.pdfTemplate.trim() || "Standard Template",
          lines: validLines.map((l, i) => ({
            itemId: l.itemId.trim() || null,
            expenseAccountId: l.expenseAccountId.trim() || null,
            description: l.description.trim(),
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            taxPercent: Number(l.taxPercent) || 0,
            sortOrder: i,
          })),
        }),
      });
      const j = await parseResponseJson<{ error?: string }>(res, {});
      if (!res.ok) {
        alert(j.error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/purchases/purchase-orders");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} className="mx-auto max-w-6xl pb-28 pt-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">New Purchase Order</h1>
        </div>
        <Link href="/dashboard/purchases/purchase-orders" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400">
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

          <DocumentCurrencyFields
            currency={fx.currency}
            onCurrencyChange={fx.setCurrency}
            exchangeRate={fx.exchangeRate}
            onExchangeRateChange={fx.setExchangeRate}
            baseCurrency={fx.baseCurrency}
            isForeign={fx.isForeign}
            catalogRate={fx.catalogRate}
            documentTotal={totals.grand}
            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-950/30"
          />

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-start">
            <label className={`${labelClass} pt-1`}>
              Delivery Address <span className={reqClass}>*</span>
            </label>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={form.deliveryMode === "ORGANIZATION"}
                    onChange={() => setForm((f) => ({ ...f, deliveryMode: "ORGANIZATION", deliveryCustomerId: "" }))}
                  />
                  Organization
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={form.deliveryMode === "CUSTOMER"}
                    onChange={() => setForm((f) => ({ ...f, deliveryMode: "CUSTOMER" }))}
                  />
                  Customer
                </label>
              </div>
              {form.deliveryMode === "CUSTOMER" ? (
                <select
                  value={form.deliveryCustomerId}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryCustomerId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              ) : null}
              <textarea
                rows={4}
                value={form.deliverySnapshot}
                onChange={(e) => setForm((f) => ({ ...f, deliverySnapshot: e.target.value }))}
                placeholder="Delivery address — edit destination details"
                className={`${inputClass} resize-y`}
              />
              <button type="button" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Change destination to deliver
              </button>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Purchase Order# <span className={reqClass}>*</span>
            </label>
            <div className="flex gap-2">
              <input
                required
                value={form.poNumber}
                onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))}
                className={inputClass}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label="Numbering settings"
                onClick={() => alert("Auto-numbering uses the next PO-##### in sequence when the field is left blank.")}
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>Reference#</label>
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>Date</label>
            <input type="date" required value={form.poDate} onChange={(e) => setForm((f) => ({ ...f, poDate: e.target.value }))} className={inputClass} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
              <label className={labelClass}>Delivery Date</label>
              <input
                type="date"
                value={form.expectedDate}
                onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
              <label className={labelClass}>Payment Terms</label>
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                className={inputClass}
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>Shipment Preference</label>
            <input
              value={form.shipmentPreference}
              onChange={(e) => setForm((f) => ({ ...f, shipmentPreference: e.target.value }))}
              placeholder="Choose shipment preference or type"
              className={inputClass}
            />
          </div>
        </div>

        {/* Item table */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Item Table</span>
            <button type="button" className="text-sm text-slate-400" disabled title="Coming soon">
              Bulk Actions ✓
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <tr>
                  <th className="px-3 py-2">Item details</th>
                  <th className="px-3 py-2 w-44">Account</th>
                  <th className="px-3 py-2 w-24 text-right">Qty</th>
                  <th className="px-3 py-2 w-28 text-right">Rate</th>
                  <th className="px-3 py-2 w-20 text-right">Tax %</th>
                  <th className="px-3 py-2 w-28 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const qty = Number(line.quantity);
                  const rate = Number(line.rate);
                  const tp = Number(line.taxPercent) || 0;
                  const { lineTotal } = computeLineAmounts(qty, rate, tp);
                  const amt = Number(lineTotal);
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 align-top">
                        <input
                          list={`po-items-${i}`}
                          value={line.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            const m = items.find((it) => it.name === val);
                            setLines((rows) => {
                              const next = [...rows];
                              next[i] = {
                                ...next[i]!,
                                description: val,
                                itemId: m?.id ?? "",
                              };
                              return next;
                            });
                          }}
                          placeholder="Type or click to select an item"
                          className={inputClass}
                        />
                        <datalist id={`po-items-${i}`}>
                          {items.map((it) => (
                            <option key={it.id} value={it.name} />
                          ))}
                        </datalist>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" /> Select a project
                          </span>
                          <button type="button" className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                            <Tag className="h-3.5 w-3.5" /> Reporting Tags
                          </button>
                        </div>
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
                      <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800 dark:text-slate-200">{amt.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLines((rows) => [...rows, emptyLine()])}
              className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              + Add New Row
            </button>
            <button
              type="button"
              className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              onClick={() => alert("Bulk item import will be available in a future update.")}
            >
              + Add Items in Bulk
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start">
          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea
              rows={5}
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              placeholder="Will be displayed on purchase order."
              className={`${inputClass} mt-1 resize-y`}
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-sm dark:border-slate-700">
              <span>Sub Total</span>
              <span className="tabular-nums">{totals.net.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 text-sm dark:border-slate-700">
              <span>Discount</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
                />
                <span>%</span>
                <span className="min-w-[4rem] text-right tabular-nums text-slate-600 dark:text-slate-400">{totals.discountAmt.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2 border-b border-slate-200 py-3 dark:border-slate-700">
              <div className="flex flex-wrap gap-4 text-sm">
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
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Withholding amount</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.withholdingAmount}
                  onChange={(e) => setForm((f) => ({ ...f, withholdingAmount: e.target.value }))}
                  className="w-28 rounded border border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (lines)</span>
                <span className="tabular-nums">{totals.tax.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between gap-4 border-b border-dashed border-slate-300 py-2 text-sm dark:border-slate-600">
              <span>Adjustment</span>
              <input
                type="number"
                step="0.01"
                value={form.adjustmentAmount}
                onChange={(e) => setForm((f) => ({ ...f, adjustmentAmount: e.target.value }))}
                className="w-28 rounded border border-dashed border-slate-300 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div className="flex justify-between gap-4 pt-3 text-base font-semibold">
              <span>Total ({fx.currency})</span>
              <span className="tabular-nums">{totals.grand.toFixed(2)}</span>
            </div>
            {fx.isForeign && fx.toBaseAmount(totals.grand) != null ? (
              <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                ≈ {fx.baseCurrency} {fx.toBaseAmount(totals.grand)!.toFixed(2)} base
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Terms &amp; Conditions</span>
            <textarea
              rows={5}
              value={form.termsAndConditions}
              onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))}
              placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
              className={`${inputClass} mt-1 resize-y`}
            />
          </label>
          <div>
            <span className={labelClass}>Attach File(s) to Purchase Order</span>
            <div className="mt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-900">
                <span>Upload File</span>
                <span className="text-slate-400">▾</span>
                <input type="file" multiple className="hidden" disabled />
              </label>
              <p className="mt-2 text-xs text-slate-500">You can upload a maximum of 10 files, 10MB each (storage integration coming soon).</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Additional Fields: Start adding custom fields for your purchase orders by going to{" "}
          <em>
            Settings → Purchases → Purchase Orders
          </em>
          .
        </p>

        <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              onClick={() => {
                saveIntent.current = "draft";
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button
              type="submit"
              disabled={saving}
              onClick={() => {
                saveIntent.current = "send";
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save and Send
            </button>
            <Link
              href="/dashboard/purchases/purchase-orders"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Cancel
            </Link>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            PDF Template: &apos;{form.pdfTemplate}&apos;{" "}
            <button
              type="button"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => alert("Template picker will be available in a future update.")}
            >
              Change
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
