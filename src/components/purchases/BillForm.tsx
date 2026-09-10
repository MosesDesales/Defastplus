"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, FileText, HelpCircle, Info, Repeat, Search, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentOcrModal } from "@/components/ocr/DocumentOcrModal";
import { DocumentCurrencyFields, useDocumentCurrency } from "@/components/DocumentCurrencyFields";
import { bestPartyMatch } from "@/lib/ocr/party-match";
import type { OcrExtractedDocument } from "@/lib/ocr/types";
import { resolveInterStateForLine } from "@/lib/gst/item-gst";
import { billLineGstPercentFromItem, splitTaxAmountIntoComponents } from "@/lib/gst/line-india-tax";
import { computeBillLineAmounts, round2 } from "@/lib/purchases/line-math";
import { parseResponseJson } from "@/lib/parse-response-json";

type VendorOpt = { id: string; displayName: string; gstin?: string | null; currency?: string | null };
type CustomerOpt = { id: string; displayName: string };
type ItemOpt = {
  id: string;
  name: string;
  gstTaxPreference: string;
  gstApplicable: boolean;
  gstRate: number;
  gstTaxMode: string;
};
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

export function BillForm({
  purchaseOrderId,
  companyGstin,
}: Readonly<{ purchaseOrderId?: string; companyGstin?: string | null }>) {
  const router = useRouter();
  const saveIntent = useRef<"draft" | "open">("draft");
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AcctOpt[]>([]);
  const [liabilityAccounts, setLiabilityAccounts] = useState<AcctOpt[]>([]);
  const [form, setForm] = useState({
    vendorId: "",
    billNumber: "",
    orderNumber: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    paymentTerms: "DUE_ON_RECEIPT",
    accountsPayableAccountId: "",
    subject: "",
    notesInternal: "",
    withholdingType: "NONE" as "NONE" | "TDS" | "TCS",
    withholdingAmount: "0",
    adjustmentAmount: "0",
    pdfTemplate: "Standard Template",
  });
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const fx = useDocumentCurrency("INR");

  const loadRefs = useCallback(async () => {
    const [vRes, cRes, iRes, aRes, bRes] = await Promise.all([
      fetch("/api/purchases/vendors", { cache: "no-store", credentials: "include" }),
      fetch("/api/customers", { cache: "no-store", credentials: "include" }),
      fetch("/api/inventory/items", { cache: "no-store", credentials: "include" }),
      fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" }),
      fetch("/api/purchases/bills", { cache: "no-store", credentials: "include" }),
    ]);
    const vData = await parseResponseJson<{ vendors?: VendorOpt[] }>(vRes, {});
    const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
    const iData = await parseResponseJson<{ items?: ItemOpt[] }>(iRes, {});
    const aData = await parseResponseJson<{ accounts?: AcctOpt[] }>(aRes, {});
    const bData = await parseResponseJson<{ bills?: { billNumber: string }[] }>(bRes, {});
    setVendors(vData.vendors ?? []);
    setCustomers(cData.customers ?? []);
    setItems(
      (iData.items ?? []).map((x: ItemOpt) => ({
        id: x.id,
        name: x.name,
        gstTaxPreference: x.gstTaxPreference ?? "TAXABLE",
        gstApplicable: x.gstApplicable ?? true,
        gstRate: typeof x.gstRate === "number" ? x.gstRate : Number(x.gstRate ?? 0),
        gstTaxMode: x.gstTaxMode ?? "AUTO",
      })),
    );
    const accts = (aData.accounts ?? []).filter((a) => a.isActive !== false);
    setExpenseAccounts(accts.filter((a) => a.type === "EXPENSE"));
    setLiabilityAccounts(accts.filter((a) => a.type === "LIABILITY"));
    const n = (bData.bills ?? []).length;
    setForm((f) => ({
      ...f,
      billNumber: f.billNumber || `BILL-${String(n + 1).padStart(5, "0")}`,
    }));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load reference lists on mount
    void loadRefs();
  }, [loadRefs]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === form.vendorId) ?? null,
    [vendors, form.vendorId],
  );

  useEffect(() => {
    if (selectedVendor?.currency) fx.applyPartyCurrency(selectedVendor.currency);
  }, [selectedVendor?.id, selectedVendor?.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchItemId = useCallback(
    (name: string) => {
      const n = name.toLowerCase().trim();
      if (!n) return "";
      const exact = items.find((i) => i.name.toLowerCase() === n);
      if (exact) return exact.id;
      const partial = items.find((i) => n.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(n));
      return partial?.id ?? "";
    },
    [items],
  );

  const applyOcrBill = useCallback(
    (d: OcrExtractedDocument) => {
      const byGstin = d.partyGstin
        ? vendors.find((v) => v.gstin?.trim().toUpperCase() === d.partyGstin!.trim().toUpperCase())?.id
        : undefined;
      const vid = byGstin ?? bestPartyMatch(vendors, d.partyName);
      setForm((f) => ({
        ...f,
        ...(vid ? { vendorId: vid } : {}),
        ...(d.invoiceNo ? { billNumber: d.invoiceNo.slice(0, 80) } : {}),
        ...(d.purchaseOrderNo ? { orderNumber: d.purchaseOrderNo.slice(0, 80) } : {}),
        ...(d.invoiceDate ? { billDate: d.invoiceDate } : {}),
        ...(d.dueDate ? { dueDate: d.dueDate } : {}),
      }));
      if (d.items.length > 0) {
        setLines(
          d.items.map((it) => {
            const itemId = matchItemId(it.name);
            const rowItem = itemId ? items.find((i) => i.id === itemId) : undefined;
            const tp = it.taxPercent ?? (rowItem ? billLineGstPercentFromItem(rowItem) : 0);
            return {
              itemId,
              description: (it.description ? `${it.name} — ${it.description}` : it.name).slice(0, 2000),
              expenseAccountId: "",
              customerId: "",
              quantity: String(it.qty || 1),
              rate: String(it.rate ?? 0),
              discountPercent: "0",
              taxPercent: String(tp),
            };
          }),
        );
      }
    },
    [items, matchItemId, vendors],
  );

  useEffect(() => {
    if (!purchaseOrderId) return;
    void (async () => {
      const res = await fetch(`/api/purchases/purchase-orders/${purchaseOrderId}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await parseResponseJson<{
        purchaseOrder?: {
          vendorId: string;
          currency?: string;
          exchangeRate?: number | null;
          lines: Array<{ description: string; quantity: number; rate: number; taxPercent: number; expenseAccountId?: string | null }>;
        };
      }>(res, {});
      if (data.purchaseOrder) {
        setForm((f) => ({ ...f, vendorId: data.purchaseOrder!.vendorId }));
        if (data.purchaseOrder.currency) {
          fx.setCurrency(data.purchaseOrder.currency);
          if (data.purchaseOrder.exchangeRate != null) {
            fx.setExchangeRate(String(data.purchaseOrder.exchangeRate));
          }
        }
        setLines(
          data.purchaseOrder!.lines.map((l) => ({
            itemId: "",
            description: l.description,
            quantity: String(l.quantity),
            rate: String(l.rate),
            taxPercent: String(l.taxPercent),
            discountPercent: "0",
            expenseAccountId: l.expenseAccountId ?? "",
            customerId: "",
          })),
        );
      }
    })();
  }, [purchaseOrderId]);

  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    let lineSum = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const vendorGstin = vendors.find((v) => v.id === form.vendorId)?.gstin ?? null;
    for (const l of lines) {
      const qty = Number(l.quantity);
      const rate = Number(l.rate);
      const dp = Number(l.discountPercent) || 0;
      const itemRow = l.itemId ? items.find((it) => it.id === l.itemId) : undefined;
      let tp = Number(l.taxPercent) || 0;
      if (itemRow) tp = billLineGstPercentFromItem(itemRow);
      const { lineNet, lineTax, lineTotal } = computeBillLineAmounts(qty, rate, dp, tp);
      const inter = itemRow
        ? resolveInterStateForLine(itemRow.gstTaxMode as "AUTO" | "INTRA" | "INTER", companyGstin ?? null, vendorGstin)
        : resolveInterStateForLine("AUTO", companyGstin ?? null, vendorGstin);
      const br = splitTaxAmountIntoComponents(Number(lineTax), inter);
      net += Number(lineNet);
      tax += Number(lineTax);
      lineSum += Number(lineTotal);
      cgst += br.cgst;
      sgst += br.sgst;
      igst += br.igst;
    }
    const adj = Number(form.adjustmentAmount) || 0;
    const wh = Number(form.withholdingAmount) || 0;
    const grand = round2(lineSum + adj - wh);
    return { net, tax, lineSum, grand, cgst, sgst, igst };
  }, [lines, form.adjustmentAmount, form.withholdingAmount, form.vendorId, items, vendors, companyGstin]);

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
      const status = saveIntent.current === "open" ? "UNPAID" : "DRAFT";
      const res = await fetch("/api/purchases/bills", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          ...fx.payloadFields(),
          billNumber: form.billNumber.trim() || null,
          reference: null,
          orderNumber: form.orderNumber.trim() || null,
          subject: form.subject.trim() || null,
          billDate: form.billDate,
          dueDate: form.dueDate.trim() || null,
          paymentTerms: form.paymentTerms,
          accountsPayableAccountId: form.accountsPayableAccountId.trim() || null,
          notesInternal: form.notesInternal.trim() || null,
          purchaseOrderId: purchaseOrderId ?? null,
          status,
          withholdingType: form.withholdingType,
          withholdingAmount: Number(form.withholdingAmount) || 0,
          adjustmentAmount: Number(form.adjustmentAmount) || 0,
          pdfTemplate: form.pdfTemplate.trim() || "Standard Template",
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
        alert(j.error ?? "Could not save bill.");
        return;
      }
      router.push("/dashboard/purchases/bills");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} className="mx-auto max-w-6xl pb-28 pt-2">
      <DocumentOcrModal open={ocrOpen} onOpenChange={setOcrOpen} documentType="BILL" onApply={applyOcrBill} />
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">New Bill</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOcrOpen(true)}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800"
          >
            Upload document (OCR)
          </button>
          <Link href="/dashboard/purchases/bills" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400">
            Close
          </Link>
        </div>
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

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Bill# <span className={reqClass}>*</span>
            </label>
            <input required value={form.billNumber} onChange={(e) => setForm((f) => ({ ...f, billNumber: e.target.value }))} className={inputClass} />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>Order Number</label>
            <input value={form.orderNumber} onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))} className={inputClass} />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={labelClass}>
              Bill Date <span className={reqClass}>*</span>
            </label>
            <input type="date" required value={form.billDate} onChange={(e) => setForm((f) => ({ ...f, billDate: e.target.value }))} className={inputClass} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
            <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
              <label className={labelClass}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputClass} />
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

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className={`${labelClass} inline-flex items-center gap-1`}>
              Accounts Payable
              <button type="button" className="text-slate-400 hover:text-slate-600" title="Liability account credited for the bill balance" aria-label="Help">
                <HelpCircle className="h-4 w-4" />
              </button>
            </label>
            <select
              value={form.accountsPayableAccountId}
              onChange={(e) => setForm((f) => ({ ...f, accountsPayableAccountId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Default (Accounts Payable from chart)</option>
              {liabilityAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-start">
            <label className={`${labelClass} inline-flex items-center gap-1 pt-2`}>
              Subject
              <span title="Shown on documents" className="text-slate-400">
                <Info className="h-4 w-4" aria-hidden />
              </span>
            </label>
            <textarea
              rows={3}
              maxLength={250}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Enter a subject within 250 characters"
              className={`${inputClass} resize-y`}
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
            <table className="w-full min-w-[1380px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <tr>
                  <th className="px-3 py-2">Item details</th>
                  <th className="px-3 py-2 w-40">Account</th>
                  <th className="px-3 py-2 w-24 text-right">Qty</th>
                  <th className="px-3 py-2 w-28 text-right">Rate</th>
                  <th className="px-3 py-2 w-24 text-right">Discount %</th>
                  <th className="px-3 py-2 w-20 text-right">Tax %</th>
                  <th className="px-3 py-2 w-20 text-right">CGST</th>
                  <th className="px-3 py-2 w-20 text-right">SGST</th>
                  <th className="px-3 py-2 w-20 text-right">IGST</th>
                  <th className="px-3 py-2 w-36">Customer</th>
                  <th className="px-3 py-2 w-28 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const qty = Number(line.quantity);
                  const rate = Number(line.rate);
                  const dp = Number(line.discountPercent) || 0;
                  const itemRow = line.itemId ? items.find((it) => it.id === line.itemId) : undefined;
                  let tp = Number(line.taxPercent) || 0;
                  if (itemRow) tp = billLineGstPercentFromItem(itemRow);
                  const { lineTax, lineTotal } = computeBillLineAmounts(qty, rate, dp, tp);
                  const vendorGstin = vendors.find((v) => v.id === form.vendorId)?.gstin ?? null;
                  const inter = itemRow
                    ? resolveInterStateForLine(itemRow.gstTaxMode as "AUTO" | "INTRA" | "INTER", companyGstin ?? null, vendorGstin)
                    : resolveInterStateForLine("AUTO", companyGstin ?? null, vendorGstin);
                  const gstBr = splitTaxAmountIntoComponents(Number(lineTax), inter);
                  const amt = Number(lineTotal);
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 align-top">
                        <input
                          list={`bill-items-${i}`}
                          value={line.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            const m = items.find((it) => it.name === val);
                            setLines((rows) => {
                              const next = [...rows];
                              const taxStr = m ? String(billLineGstPercentFromItem(m)) : next[i]!.taxPercent;
                              next[i] = { ...next[i]!, description: val, itemId: m?.id ?? "", taxPercent: taxStr };
                              return next;
                            });
                          }}
                          placeholder="Type or click to select an item"
                          className={inputClass}
                        />
                        <datalist id={`bill-items-${i}`}>
                          {items.map((it) => (
                            <option key={it.id} value={it.name} />
                          ))}
                        </datalist>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-blue-600 dark:text-blue-400">
                          <button type="button" className="hover:underline">
                            Purchase Discounts %
                          </button>
                          <button type="button" className="inline-flex items-center gap-1 hover:underline">
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
                          value={itemRow ? String(tp) : line.taxPercent}
                          disabled={Boolean(itemRow)}
                          title={itemRow ? "Tax % comes from the catalog item; clear item match to edit manually." : undefined}
                          onChange={(e) => {
                            setLines((rows) => {
                              const next = [...rows];
                              next[i] = { ...next[i]!, taxPercent: e.target.value, itemId: "" };
                              return next;
                            });
                          }}
                          className={`${inputClass} text-right tabular-nums disabled:opacity-60`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {gstBr.cgst.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {gstBr.sgst.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {gstBr.igst.toFixed(2)}
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
                      <td className="px-3 py-2 align-top text-right tabular-nums font-medium text-slate-900 dark:text-white">{amt.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLines((rows) => [...rows, emptyLine()])}
              className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              + Add New Row
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
            <div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <span>CGST / SGST / IGST (split)</span>
              <span className="tabular-nums">
                {totals.cgst.toFixed(2)} / {totals.sgst.toFixed(2)} / {totals.igst.toFixed(2)}
              </span>
            </div>
            <div className="space-y-2 border-b border-slate-200 py-3 dark:border-slate-700">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="wh" checked={form.withholdingType === "TDS"} onChange={() => setForm((f) => ({ ...f, withholdingType: "TDS" }))} />
                  TDS
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="wh" checked={form.withholdingType === "TCS"} onChange={() => setForm((f) => ({ ...f, withholdingType: "TCS" }))} />
                  TCS
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="wh" checked={form.withholdingType === "NONE"} onChange={() => setForm((f) => ({ ...f, withholdingType: "NONE" }))} />
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
            <span className={labelClass}>Notes</span>
            <textarea
              rows={5}
              value={form.notesInternal}
              onChange={(e) => setForm((f) => ({ ...f, notesInternal: e.target.value }))}
              placeholder="Internal notes"
              className={`${inputClass} mt-1 resize-y`}
            />
            <p className="mt-1 text-xs text-slate-500">It will not be shown in PDF</p>
          </label>
          <div>
            <span className={labelClass}>Attach File(s) to Bill</span>
            <label className="mt-2 inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium opacity-70 dark:border-slate-600 dark:bg-slate-900">
              <span>Upload File</span>
              <span className="text-slate-400">▾</span>
              <input type="file" multiple className="hidden" disabled />
            </label>
            <p className="mt-2 text-xs text-slate-500">You can upload a maximum of 5 files, 10MB each (storage integration coming soon).</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold">Additional Fields:</span> Start adding custom fields for your bills by going to{" "}
          <em>Settings → Purchases → Bills</em>.
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
                saveIntent.current = "open";
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save as Open
            </button>
            <Link
              href="/dashboard/purchases/bills"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Cancel
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span>
              PDF Template: &apos;{form.pdfTemplate}&apos;{" "}
              <button type="button" className="font-medium text-blue-600 hover:underline dark:text-blue-400" onClick={() => alert("Template picker coming soon.")}>
                Change
              </button>
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => router.push("/dashboard/purchases/recurring-bills/new")}
            >
              <Repeat className="h-4 w-4" /> Make Recurring
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
