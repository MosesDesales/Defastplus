"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/15 transition focus:border-teal-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const selectClass =
  inputClass +
  " appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9";

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")";

export type QuoteCustomerOption = { id: string; displayName: string };
export type QuoteItemOption = { id: string; name: string; salesRate: number; unit: string };

function rndKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r-${Date.now()}-${Math.random()}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type LineRow = { key: string; itemId: string | null; description: string; quantity: string; rate: string };

export function QuoteCreateForm({
  customers,
  items,
  defaultQuoteNumber,
  defaultQuoteDate,
  defaultSalespersonName,
}: Readonly<{
  customers: QuoteCustomerOption[];
  items: QuoteItemOption[];
  defaultQuoteNumber: string;
  defaultQuoteDate: string;
  defaultSalespersonName: string;
}>) {
  const router = useRouter();
  const customerSelectRef = useRef<HTMLSelectElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"draft" | "send" | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState(defaultQuoteNumber);
  const [reference, setReference] = useState("");
  const [quoteDate, setQuoteDate] = useState(defaultQuoteDate);
  const [expiryDate, setExpiryDate] = useState("");
  const [salesperson, setSalesperson] = useState(defaultSalespersonName);
  const [projectName, setProjectName] = useState("");
  const [subject, setSubject] = useState("");

  const [lines, setLines] = useState<LineRow[]>([
    { key: rndKey(), itemId: null, description: "", quantity: "1", rate: "0" },
  ]);

  const [customerNotes, setCustomerNotes] = useState("Looking forward for your business.");
  const [termsAndConditions, setTermsAndConditions] = useState("");

  const [discountMode, setDiscountMode] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [discountInput, setDiscountInput] = useState("0");

  const [withholdingType, setWithholdingType] = useState<"TDS" | "TCS" | "NONE">("TDS");
  const [taxSelectLabel, setTaxSelectLabel] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");

  const [adjustmentLabel, setAdjustmentLabel] = useState("Adjustment");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");

  const [pdfTemplate, setPdfTemplate] = useState("Spreadsheet Template");

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemByName = useMemo(() => new Map(items.map((i) => [i.name.trim().toLowerCase(), i])), [items]);

  const lineAmounts = useMemo(() => {
    return lines.map((l) => {
      const q = parseFloat(l.quantity);
      const r = parseFloat(l.rate);
      const qty = Number.isFinite(q) ? q : 0;
      const rate = Number.isFinite(r) ? r : 0;
      return round2(qty * rate);
    });
  }, [lines]);

  const subTotal = useMemo(() => round2(lineAmounts.reduce((s, a) => s + a, 0)), [lineAmounts]);

  const discountVal = parseFloat(discountInput);
  const discountAmt = useMemo(() => {
    const v = Number.isFinite(discountVal) ? discountVal : 0;
    if (discountMode === "PERCENT") {
      return round2((subTotal * v) / 100);
    }
    return round2(Math.min(v, subTotal));
  }, [discountMode, discountVal, subTotal]);

  const taxVal = parseFloat(taxAmount);
  const taxNum = Number.isFinite(taxVal) ? round2(taxVal) : 0;

  const adjVal = parseFloat(adjustmentAmount);
  const adjNum = Number.isFinite(adjVal) ? round2(adjVal) : 0;

  const totalPreview = useMemo(() => {
    let t = round2(subTotal - discountAmt + adjNum);
    if (withholdingType === "TDS") {
      t = round2(t - taxNum);
    } else if (withholdingType === "TCS") {
      t = round2(t + taxNum);
    }
    return t;
  }, [subTotal, discountAmt, adjNum, withholdingType, taxNum]);

  function addRow() {
    setLines((prev) => [...prev, { key: rndKey(), itemId: null, description: "", quantity: "1", rate: "0" }]);
  }

  function updateLine(key: string, patch: Partial<Omit<LineRow, "key">>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function applyItemToLine(key: string, itemId: string) {
    const item = itemById.get(itemId);
    if (!item) return;
    updateLine(key, {
      itemId: item.id,
      description: item.name,
      rate: String(Number(item.salesRate)),
    });
  }

  function onDescriptionBlur(key: string, description: string) {
    const match = itemByName.get(description.trim().toLowerCase());
    if (match) {
      updateLine(key, {
        itemId: match.id,
        rate: String(Number(match.salesRate)),
      });
    }
  }

  async function submit(status: "DRAFT" | "SENT") {
    setError(null);
    if (!customerId) {
      setError("Select a customer.");
      return;
    }

    const cleaned = lines
      .map((l) => ({
        itemId: l.itemId,
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
        rate: parseFloat(l.rate),
      }))
      .filter((l) => l.description.length > 0);

    if (cleaned.length === 0) {
      setError("Add at least one line item with details.");
      return;
    }

    for (const l of cleaned) {
      if (!Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.rate) || l.rate < 0) {
        setError("Each line needs a valid quantity and rate.");
        return;
      }
    }

    setLoadingAction(status === "DRAFT" ? "draft" : "send");

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          quoteNumber,
          reference: reference.trim() || null,
          quoteDate,
          expiryDate: expiryDate.trim() || null,
          salesperson: salesperson.trim() || null,
          projectName: projectName.trim() || null,
          subject: subject.trim() || null,
          customerNotes: customerNotes.trim() || null,
          termsAndConditions: termsAndConditions.trim() || null,
          discountMode,
          discountInput: parseFloat(discountInput) || 0,
          withholdingType,
          taxSelectLabel: taxSelectLabel.trim() || null,
          taxAmount: parseFloat(taxAmount) || 0,
          adjustmentLabel: adjustmentLabel.trim() || "Adjustment",
          adjustmentAmount: parseFloat(adjustmentAmount) || 0,
          pdfTemplate,
          status,
          lines: cleaned.map((l) => ({
            itemId: l.itemId,
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
          })),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save quote");
        return;
      }
      router.push("/dashboard/sales/quotes");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  const itemDatalistId = "quote-item-names";

  return (
    <div className="relative mx-auto max-w-5xl rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" aria-hidden>
            ⧉
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">New Quote</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Quote / estimate document</p>
          </div>
        </div>
        <Link
          href="/dashboard/sales/quotes"
          className="rounded-full px-2 py-1 text-xl leading-none text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          aria-label="Close"
        >
          ×
        </Link>
      </div>

      <div className="space-y-5 px-5 py-6">
        {error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">{error}</div>
        ) : null}

        <datalist id={itemDatalistId}>
          {items.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>

        <div className="grid gap-5 sm:grid-cols-[minmax(140px,220px)_1fr] sm:items-start">
          <div className="flex justify-start gap-2 pt-2 text-right sm:justify-end">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Customer name <span aria-hidden>*</span>
            </span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500" title="Bill-to customer">
              i
            </span>
          </div>
          <div className="flex gap-2">
            <select
              ref={customerSelectRef}
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={selectClass}
              style={{ backgroundImage: `url("${chevron}")` }}
            >
              <option value="">Select or add a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-teal-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-slate-800"
              aria-label="Search customers"
              onClick={() => customerSelectRef.current?.focus()}
            >
              🔍
            </button>
          </div>

          <div className="flex justify-start gap-2 pt-2 text-right sm:justify-end">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Quote# <span aria-hidden>*</span>
            </span>
          </div>
          <div className="flex gap-2">
            <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} className={inputClass} />
            <button
              type="button"
              title="Numbering preferences"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-teal-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-teal-300"
              onClick={() => {
                const next = window.prompt("Quote number (e.g. QT-000042)", quoteNumber);
                if (next?.trim()) setQuoteNumber(next.trim());
              }}
            >
              ⚙
            </button>
          </div>

          <span className="pt-2 text-right text-sm text-slate-700 dark:text-slate-300">Reference#</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />

          <span className="pt-2 text-right text-sm font-medium text-red-600 dark:text-red-400">
            Quote date <span aria-hidden>*</span>
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className={inputClass} />
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Expiry date</p>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <span className="pt-2 text-right text-sm text-slate-700 dark:text-slate-300">Salesperson</span>
          <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={selectClass} style={{ backgroundImage: `url("${chevron}")` }}>
            <option value="">Select or Add Salesperson</option>
            <option value={defaultSalespersonName}>{defaultSalespersonName}</option>
          </select>

          <span className="pt-2 text-right text-sm text-slate-700 dark:text-slate-300">Project name</span>
          <div>
            <select
              disabled={!customerId}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={`${selectClass} disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-900`}
              style={{ backgroundImage: `url("${chevron}")` }}
            >
              <option value="">Select a project</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a customer to associate a project.</p>
          </div>

          <div className="flex justify-start gap-2 pt-2 text-right sm:justify-end">
            <span className="text-sm text-slate-700 dark:text-slate-300">Subject</span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500" title="Shown on the PDF">
              i
            </span>
          </div>
          <textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Let your customer know what this Quote is for"
            rows={3}
            className={`${inputClass} resize-y min-h-[5rem]`}
          />
        </div>

        {/* Item table */}
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Item table</h2>
            <button type="button" className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400">
              ✓ Bulk actions
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left">Item details</th>
                  <th className="w-28 px-3 py-2 text-right">Quantity</th>
                  <th className="w-32 px-3 py-2 text-right">Rate</th>
                  <th className="w-32 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td className="px-2 py-2 align-top text-slate-400">⠿</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-2">
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value, itemId: null })}
                          onBlur={(e) => onDescriptionBlur(line.key, e.target.value)}
                          placeholder="Type or click to select an item."
                          list={itemDatalistId}
                          className={inputClass}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={line.itemId ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              applyItemToLine(line.key, v);
                            }}
                            className={`${selectClass} max-w-xs text-xs`}
                            style={{ backgroundImage: `url("${chevron}")` }}
                          >
                            <option value="">Catalog…</option>
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                            🏷 Reporting tags ▾
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        inputMode="decimal"
                        className={`${inputClass} text-right tabular-nums`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="relative">
                        <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden>
          ⊞
                        </span>
                        <input
                          value={line.rate}
                          onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                          inputMode="decimal"
                          className={`${inputClass} pr-10 text-right tabular-nums`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                      {fmt(lineAmounts[idx] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <button type="button" onClick={addRow} className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400">
              + Add new row ▾
            </button>
            <button type="button" className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400">
              + Add items in bulk
            </button>
          </div>
        </div>

        {/* Notes + totals */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Customer notes</label>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={5}
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex justify-between border-b border-slate-200 py-2 text-sm dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Sub total</span>
              <span className="tabular-nums text-slate-900 dark:text-white">{fmt(subTotal)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400">Discount</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  inputMode="decimal"
                  className={`${inputClass} w-24 text-right tabular-nums`}
                />
                <select
                  value={discountMode}
                  onChange={(e) => setDiscountMode(e.target.value as "PERCENT" | "AMOUNT")}
                  className={`${selectClass} w-[4.5rem]`}
                  style={{ backgroundImage: `url("${chevron}")` }}
                >
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">₹</option>
                </select>
                <span className="tabular-nums text-sm font-medium text-slate-900 dark:text-white">{fmt(discountAmt)}</span>
              </div>
            </div>

            <div className="border-b border-slate-200 py-3 dark:border-slate-800">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={withholdingType === "TDS"}
                    onChange={() => setWithholdingType("TDS")}
                    className="border-slate-300 text-teal-600"
                  />
                  TDS
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={withholdingType === "TCS"}
                    onChange={() => setWithholdingType("TCS")}
                    className="border-slate-300 text-teal-600"
                  />
                  TCS
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={withholdingType === "NONE"}
                    onChange={() => setWithholdingType("NONE")}
                    className="border-slate-300 text-teal-600"
                  />
                  None
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={taxSelectLabel}
                  onChange={(e) => setTaxSelectLabel(e.target.value)}
                  className={`${selectClass} min-w-[10rem] flex-1`}
                  style={{ backgroundImage: `url("${chevron}")` }}
                >
                  <option value="">Select a Tax</option>
                  <option value="194J Professional fees">194J Professional fees</option>
                  <option value="194C Contractor">194C Contractor</option>
                </select>
                <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  {withholdingType === "NONE"
                    ? fmt(0)
                    : withholdingType === "TDS"
                      ? `− ${fmt(taxNum)}`
                      : `+ ${fmt(taxNum)}`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 dark:border-slate-800">
              <input
                value={adjustmentLabel}
                onChange={(e) => setAdjustmentLabel(e.target.value)}
                className={`${inputClass} max-w-[10rem] border-dashed`}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400" title="Shipping or other adjustments">
                  ?
                </span>
                <input
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  inputMode="decimal"
                  className={`${inputClass} w-28 text-right tabular-nums`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className="text-base font-bold text-slate-900 dark:text-white">Total ( ₹ )</span>
              <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmt(totalPreview)}</span>
            </div>
          </div>
        </div>

        {/* Terms + attach */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Terms &amp; conditions</label>
            <textarea
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
              rows={6}
              className={`${inputClass} resize-y min-h-[8rem]`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Attach file(s) to Quote</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              <span aria-hidden>☁</span>
              Upload file <span className="text-slate-400">▾</span>
              <input type="file" multiple className="hidden" />
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">You can upload a maximum of 5 files, 10MB each. Storage integration coming soon.</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Additional fields:</span> Start adding custom fields for your quotes by going to{" "}
          <span className="font-semibold">Settings → Sales → Quotes</span>.
        </p>

        <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => submit("DRAFT")}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {loadingAction === "draft" ? "Saving…" : "Save as Draft"}
            </button>
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => submit("SENT")}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingAction === "send" ? "Saving…" : "Save and Send"}
            </button>
            <Link
              href="/dashboard/sales/quotes"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Cancel
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>
              PDF Template: <span className="font-medium text-slate-900 dark:text-slate-100">&lsquo;{pdfTemplate}&rsquo;</span>
            </span>
            <button
              type="button"
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => {
                const v = window.prompt("PDF template name", pdfTemplate);
                if (v?.trim()) setPdfTemplate(v.trim());
              }}
            >
              Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
