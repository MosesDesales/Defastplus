"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentOcrModal } from "@/components/ocr/DocumentOcrModal";
import { DocumentCurrencyFields, useDocumentCurrency } from "@/components/DocumentCurrencyFields";
import { resolveInterStateForLine } from "@/lib/gst/item-gst";
import { bestPartyMatch } from "@/lib/ocr/party-match";
import type { OcrExtractedDocument } from "@/lib/ocr/types";
import {
  computeIndiaGstSplit,
  invoiceLineGstPercentFromItem,
  round2,
} from "@/lib/gst/line-india-tax";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const tableInputClass =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs tabular-nums sm:px-2 sm:text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const summaryLabelClass = "text-sm font-medium text-slate-800 dark:text-slate-200";
const summaryValueClass = "text-right text-sm tabular-nums text-slate-900 dark:text-white";

type CustomerOpt = { id: string; displayName: string; gstin: string | null; currency?: string | null };
type ItemOpt = {
  id: string;
  name: string;
  salesRate: number;
  gstTaxPreference: string;
  gstApplicable: boolean;
  gstRate: number;
  hsnCode: string | null;
  gstTaxMode: string;
};

type Line = {
  key: string;
  description: string;
  quantity: string;
  rate: string;
  taxPercent: string;
  itemId: string | null;
};

type InvoiceTemplateOpt = { id: string; name: string; isDefault?: boolean; isDefaultForModule?: boolean };

function rnd() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `l-${Date.now()}`;
}

export function InvoiceCreateForm({
  customers,
  items,
  defaultIssueDate,
  companyGstin,
  baseCurrency = "INR",
  invoiceTemplates,
  defaultInvoiceTemplateId,
}: Readonly<{
  customers: CustomerOpt[];
  items: ItemOpt[];
  defaultIssueDate: string;
  companyGstin: string | null;
  baseCurrency?: string;
  invoiceTemplates: InvoiceTemplateOpt[];
  defaultInvoiceTemplateId: string | null;
}>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [documentTemplateId, setDocumentTemplateId] = useState(
    () => defaultInvoiceTemplateId ?? invoiceTemplates[0]?.id ?? "",
  );
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SENT">("SENT");
  const [lines, setLines] = useState<Line[]>([
    { key: rnd(), description: "", quantity: "1", rate: "0", taxPercent: "18", itemId: null },
  ]);

  const [discountPct, setDiscountPct] = useState("0");
  const [withholdingMode, setWithholdingMode] = useState<"NONE" | "TDS" | "TCS">("NONE");
  const [withholdingPct, setWithholdingPct] = useState("");
  const [adjustmentLabel, setAdjustmentLabel] = useState("Adjustment");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [ocrOpen, setOcrOpen] = useState(false);
  const fx = useDocumentCurrency(baseCurrency);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  useEffect(() => {
    if (selectedCustomer?.currency) fx.applyPartyCurrency(selectedCustomer.currency);
  }, [selectedCustomer?.id, selectedCustomer?.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchItemId = useCallback(
    (name: string) => {
      const n = name.toLowerCase().trim();
      if (!n) return null;
      const exact = items.find((i) => i.name.toLowerCase() === n);
      if (exact) return exact.id;
      const partial = items.find((i) => n.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(n));
      return partial?.id ?? null;
    },
    [items],
  );

  const applyOcrInvoice = useCallback(
    (d: OcrExtractedDocument) => {
      const cid = bestPartyMatch(customers, d.partyName);
      if (cid) setCustomerId(cid);
      if (d.invoiceDate) setIssueDate(d.invoiceDate);
      if (d.dueDate) setDueDate(d.dueDate);
      if (d.items.length > 0) {
        setLines(
          d.items.map((it) => {
            const itemId = matchItemId(it.name);
            const rowItem = itemId ? items.find((i) => i.id === itemId) : undefined;
            const desc = it.description ? `${it.name} — ${it.description}` : it.name;
            const tp = it.taxPercent ?? (rowItem ? invoiceLineGstPercentFromItem(rowItem) : 18);
            return {
              key: rnd(),
              description: desc.slice(0, 2000),
              quantity: String(it.qty || 1),
              rate: String(it.rate ?? 0),
              taxPercent: String(tp),
              itemId,
            };
          }),
        );
      }
    },
    [customers, items, matchItemId],
  );

  const linePreview = useMemo(() => {
    return lines.map((line) => {
      const qty = parseFloat(line.quantity);
      const rate = parseFloat(line.rate);
      const net = round2((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0));
      const item = line.itemId ? items.find((i) => i.id === line.itemId) : undefined;
      const taxP = item ? invoiceLineGstPercentFromItem(item) : Number.isFinite(parseFloat(line.taxPercent)) ? parseFloat(line.taxPercent) : 0;
      const inter = item
        ? resolveInterStateForLine(item.gstTaxMode as "AUTO" | "INTRA" | "INTER", companyGstin, selectedCustomer?.gstin)
        : resolveInterStateForLine("AUTO", companyGstin, selectedCustomer?.gstin);
      const split =
        taxP > 0 ? computeIndiaGstSplit(net, taxP, inter) : { cgst: 0, sgst: 0, igst: 0, lineTax: 0 };
      const total = round2(net + split.lineTax);
      return { net, taxP, ...split, total, inter };
    });
  }, [lines, items, companyGstin, selectedCustomer]);

  const footer = useMemo(() => {
    let net = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let tax = 0;
    let tot = 0;
    for (const p of linePreview) {
      net += p.net;
      cgst += p.cgst;
      sgst += p.sgst;
      igst += p.igst;
      tax += p.lineTax;
      tot += p.total;
    }
    return {
      net: round2(net),
      cgst: round2(cgst),
      sgst: round2(sgst),
      igst: round2(igst),
      tax: round2(tax),
      total: round2(tot),
    };
  }, [linePreview]);

  /** Document-level discount / withholding / adjustment (same math as typical invoice worksheet). */
  const summaryCalc = useMemo(() => {
    const subExTax = footer.net;
    const dPct = Math.min(100, Math.max(0, parseFloat(discountPct) || 0));
    const discountAmt = round2(subExTax * (dPct / 100));
    const netAfterDisc = round2(subExTax - discountAmt);
    const factor = subExTax > 0 ? netAfterDisc / subExTax : 0;
    const taxAfterDisc = round2(footer.tax * factor);
    const preWithholding = round2(netAfterDisc + taxAfterDisc);
    const whRate = Math.min(100, Math.max(0, parseFloat(withholdingPct) || 0));
    const whAmt = withholdingMode === "NONE" || whRate === 0 ? 0 : round2((preWithholding * whRate) / 100);
    const afterWh =
      withholdingMode === "TDS"
        ? round2(preWithholding - whAmt)
        : withholdingMode === "TCS"
          ? round2(preWithholding + whAmt)
          : preWithholding;
    const adj = parseFloat(adjustmentAmount);
    const adjustmentVal = Number.isFinite(adj) ? round2(adj) : 0;
    const grandTotal = round2(afterWh + adjustmentVal);
    return { subExTax, discountAmt, whAmt, adjustmentVal, grandTotal };
  }, [footer, discountPct, withholdingMode, withholdingPct, adjustmentAmount]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: rnd(), description: "", quantity: "1", rate: "0", taxPercent: "18", itemId: null },
    ]);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleaned = lines
        .map((l) => {
          const item = l.itemId ? items.find((i) => i.id === l.itemId) : undefined;
          const taxPercent = item ? invoiceLineGstPercentFromItem(item) : parseFloat(l.taxPercent);
          return {
            description: l.description.trim(),
            quantity: parseFloat(l.quantity),
            rate: parseFloat(l.rate),
            taxPercent: Number.isFinite(taxPercent) ? taxPercent : 0,
            itemId: l.itemId,
          };
        })
        .filter((l) => l.description.length > 0);

      if (!customerId || cleaned.length === 0) {
        setError("Customer and at least one line item are required.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          ...fx.payloadFields(),
          issueDate,
          dueDate: dueDate.trim() || null,
          status,
          documentTemplateId: documentTemplateId.trim() || null,
          discountPercent: Math.min(100, Math.max(0, parseFloat(discountPct) || 0)),
          withholdingType: withholdingMode,
          withholdingPercent: Math.min(100, Math.max(0, parseFloat(withholdingPct) || 0)),
          adjustmentLabel: adjustmentLabel.trim() || "Adjustment",
          adjustmentAmount: Number.isFinite(parseFloat(adjustmentAmount)) ? parseFloat(adjustmentAmount) : 0,
          lines: cleaned.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
            taxPercent: l.taxPercent,
            itemId: l.itemId,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      router.push("/dashboard/sales/invoices");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-6xl min-w-0 space-y-6">
      <DocumentOcrModal open={ocrOpen} onOpenChange={setOcrOpen} documentType="INVOICE" onApply={applyOcrInvoice} />
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOcrOpen(true)}
          className="rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-950/70"
        >
          Upload document (OCR)
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">PDF, JPG, PNG · max 5MB · review before save</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Customer *</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          {selectedCustomer?.gstin ? (
            <p className="mt-1 text-xs text-slate-500">Party GSTIN: {selectedCustomer.gstin}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              No customer GSTIN — place of supply defaults to intra-state when unknown.
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <DocumentCurrencyFields
            currency={fx.currency}
            onCurrencyChange={fx.setCurrency}
            exchangeRate={fx.exchangeRate}
            onExchangeRateChange={fx.setExchangeRate}
            baseCurrency={fx.baseCurrency}
            isForeign={fx.isForeign}
            catalogRate={fx.catalogRate}
            documentTotal={summaryCalc.grandTotal}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Issue date *</label>
          <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "SENT")} className={inputClass}>
            <option value="DRAFT">Draft (no GL posting)</option>
            <option value="SENT">Sent (posts to accounts)</option>
          </select>
        </div>
        {invoiceTemplates.length ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">PDF template</label>
            <select
              value={documentTemplateId}
              onChange={(e) => setDocumentTemplateId(e.target.value)}
              className={inputClass}
            >
              {invoiceTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefaultForModule || t.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Manage templates under{" "}
              <a href="/settings/templates?module=invoices" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
                Settings → PDF Templates
              </a>
              .
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Line items</h2>
        <p className="mt-1 text-xs text-slate-500">
          Amount ex-tax × qty. With a catalog item, GST % follows the item master (exempt / nil → 0%). CGST/SGST vs IGST uses
          company vs customer GSTIN state codes when the item is set to Auto.
        </p>
        <div className="mt-4 w-full min-w-0">
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr className="border-y border-teal-100 bg-teal-50/90 text-[10px] font-semibold uppercase tracking-wide text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-200 sm:text-xs">
                <th className="px-1 py-2 text-left sm:px-2">Item / description</th>
                <th className="px-0.5 py-2 text-right sm:px-1">Qty</th>
                <th className="px-0.5 py-2 text-right sm:px-1">Rate</th>
                <th className="px-0.5 py-2 text-right sm:px-1">GST %</th>
                <th className="px-0.5 py-2 text-right sm:px-1">Amount</th>
                <th className="px-0.5 py-2 text-right sm:px-1">CGST</th>
                <th className="px-0.5 py-2 text-right sm:px-1">SGST</th>
                <th className="px-0.5 py-2 text-right sm:px-1">IGST</th>
                <th className="px-1 py-2 text-right sm:px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const pv = linePreview[idx]!;
                return (
                  <tr key={line.key} className="border-b border-slate-100 align-top dark:border-slate-800">
                    <td className="min-w-0 px-1 py-1.5 sm:px-2">
                      <select
                        value={line.itemId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const it = items.find((i) => i.id === id);
                          const tp = it ? String(invoiceLineGstPercentFromItem(it)) : line.taxPercent;
                          updateLine(line.key, {
                            itemId: id,
                            description: it?.name ?? line.description,
                            rate: it ? String(it.salesRate) : line.rate,
                            taxPercent: tp,
                          });
                        }}
                        className={tableInputClass}
                      >
                        <option value="">Item catalog…</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Description *"
                        value={line.description}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        className={`${tableInputClass} mt-1.5`}
                      />
                    </td>
                    <td className="px-0.5 py-1.5 sm:px-1">
                      <input
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        inputMode="decimal"
                        className={tableInputClass}
                      />
                    </td>
                    <td className="px-0.5 py-1.5 sm:px-1">
                      <input
                        value={line.rate}
                        onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                        inputMode="decimal"
                        className={tableInputClass}
                      />
                    </td>
                    <td className="px-0.5 py-1.5 sm:px-1">
                      <input
                        value={line.itemId ? String(pv.taxP) : line.taxPercent}
                        onChange={(e) => updateLine(line.key, { taxPercent: e.target.value, itemId: null })}
                        inputMode="decimal"
                        disabled={Boolean(line.itemId)}
                        title={line.itemId ? "Clear item selection to edit tax % manually" : undefined}
                        className={`${tableInputClass} disabled:opacity-60`}
                      />
                    </td>
                    <td className="px-0.5 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 sm:px-1">
                      {pv.net.toFixed(2)}
                    </td>
                    <td className="px-0.5 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 sm:px-1">
                      {pv.cgst.toFixed(2)}
                    </td>
                    <td className="px-0.5 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 sm:px-1">
                      {pv.sgst.toFixed(2)}
                    </td>
                    <td className="px-0.5 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 sm:px-1">
                      {pv.igst.toFixed(2)}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-white sm:px-2">
                      {pv.total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white">
                <td colSpan={4} className="px-1 py-2.5 text-left text-xs font-semibold sm:px-2 sm:text-sm">
                  Totals
                </td>
                <td className="px-0.5 py-2.5 text-right text-xs font-semibold tabular-nums sm:px-1 sm:text-sm">
                  {footer.net.toFixed(2)}
                </td>
                <td className="px-0.5 py-2.5 text-right text-xs font-semibold tabular-nums sm:px-1 sm:text-sm">
                  {footer.cgst.toFixed(2)}
                </td>
                <td className="px-0.5 py-2.5 text-right text-xs font-semibold tabular-nums sm:px-1 sm:text-sm">
                  {footer.sgst.toFixed(2)}
                </td>
                <td className="px-0.5 py-2.5 text-right text-xs font-semibold tabular-nums sm:px-1 sm:text-sm">
                  {footer.igst.toFixed(2)}
                </td>
                <td className="px-1 py-2.5 text-right text-xs font-semibold tabular-nums text-teal-800 dark:text-teal-300 sm:px-2 sm:text-sm">
                  {footer.total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button type="button" onClick={addLine} className="mt-3 text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
          + Add line
        </button>

        <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-b from-teal-50/40 via-slate-50/60 to-white p-4 dark:border-slate-700 dark:from-teal-950/20 dark:via-slate-900/80 dark:to-slate-900 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">Summary & adjustments</h3>
          <div className="mt-4 max-w-xl space-y-3 sm:ml-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 pb-3 dark:border-slate-600/90">
              <span className={`${summaryLabelClass} font-semibold`}>Sub total</span>
              <span className={`${summaryValueClass} min-w-[5.5rem] font-semibold`}>{summaryCalc.subExTax.toFixed(2)}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={summaryLabelClass}>Discount</span>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-3 sm:min-w-0">
                <div className="flex items-center gap-1">
                  <input
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                    inputMode="decimal"
                    className={`${tableInputClass} w-16`}
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
                <span className={`${summaryValueClass} min-w-[5.5rem]`}>{summaryCalc.discountAmt.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-b border-slate-200/90 pb-3 dark:border-slate-600/90 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`${summaryLabelClass} mr-1`}>TDS / TCS</span>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="wh-mode"
                    checked={withholdingMode === "TDS"}
                    onChange={() => {
                      setWithholdingMode("TDS");
                      if (!withholdingPct) setWithholdingPct("1");
                    }}
                    className="border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>TDS</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="wh-mode"
                    checked={withholdingMode === "TCS"}
                    onChange={() => {
                      setWithholdingMode("TCS");
                      if (!withholdingPct) setWithholdingPct("1");
                    }}
                    className="border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>TCS</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="wh-mode"
                    checked={withholdingMode === "NONE"}
                    onChange={() => {
                      setWithholdingMode("NONE");
                      setWithholdingPct("");
                    }}
                    className="border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">None</span>
                </label>
              </div>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:min-w-0">
                <select
                  value={withholdingPct}
                  onChange={(e) => setWithholdingPct(e.target.value)}
                  disabled={withholdingMode === "NONE"}
                  className={`${inputClass} max-w-full flex-1 text-sm sm:max-w-[12rem] ${withholdingMode === "NONE" ? "opacity-50" : ""}`}
                >
                  <option value="">Select a tax rate</option>
                  <option value="0.1">0.1%</option>
                  <option value="0.25">0.25%</option>
                  <option value="0.5">0.5%</option>
                  <option value="1">1%</option>
                  <option value="2">2%</option>
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                </select>
                <span
                  className={`${summaryValueClass} min-w-[5.5rem] ${withholdingMode === "TDS" ? "text-amber-700 dark:text-amber-400" : withholdingMode === "TCS" ? "text-teal-700 dark:text-teal-400" : ""}`}
                >
                  {withholdingMode === "TDS" && summaryCalc.whAmt > 0 ? "− " : withholdingMode === "TCS" && summaryCalc.whAmt > 0 ? "+ " : ""}
                  {summaryCalc.whAmt.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input
                  value={adjustmentLabel}
                  onChange={(e) => setAdjustmentLabel(e.target.value)}
                  className="min-w-0 max-w-[10rem] rounded-md border border-dashed border-teal-300/80 bg-white/90 px-2 py-1.5 text-sm font-medium text-slate-800 dark:border-teal-700/60 dark:bg-slate-950 dark:text-slate-100"
                  title="Custom label for this adjustment row"
                />
                <div className="flex items-center gap-1">
                  <input
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    inputMode="decimal"
                    className={`${tableInputClass} w-24`}
                    title="Add (+) or subtract (−) a flat amount after withholding"
                  />
                  <span
                    className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 dark:border-slate-600 dark:text-slate-400"
                    title="Flat adjustment to the payable total (e.g. rounding, freight)."
                  >
                    ?
                  </span>
                </div>
              </div>
              <span className={`${summaryValueClass} min-w-[5.5rem]`}>{summaryCalc.adjustmentVal.toFixed(2)}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-600">
              <span className={`${summaryLabelClass} text-base font-bold`}>Total ({fx.currency})</span>
              <span className={`${summaryValueClass} min-w-[6rem] text-base font-bold text-teal-800 dark:text-teal-300`}>
                {summaryCalc.grandTotal.toFixed(2)}
              </span>
            </div>
            {fx.isForeign && fx.toBaseAmount(summaryCalc.grandTotal) != null ? (
              <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                ≈ {fx.baseCurrency} {fx.toBaseAmount(summaryCalc.grandTotal)!.toFixed(2)} base
              </p>
            ) : null}
          </div>
          <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-slate-500 sm:ml-auto dark:text-slate-400">
            Discount scales ex-tax and GST proportionally. TDS reduces and TCS increases the payable after tax. These values are saved on
            the invoice and shown on preview, PDF, and amount due (balance).
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save invoice"}
      </button>
    </form>
  );
}
