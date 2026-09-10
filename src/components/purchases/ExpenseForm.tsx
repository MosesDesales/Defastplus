"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, Search } from "lucide-react";
import { DocumentOcrModal } from "@/components/ocr/DocumentOcrModal";
import { CurrencySelect } from "@/components/settings/CurrencySelect";
import { bestPartyMatch } from "@/lib/ocr/party-match";
import type { OcrExtractedDocument } from "@/lib/ocr/types";
import { parseResponseJson } from "@/lib/parse-response-json";

type Acct = { id: string; code: string; name: string; type: string; isActive?: boolean };

function formatExpenseSaveError(j: { error?: string; issues?: unknown }): string {
  const base = j.error ?? "Could not save.";
  const issues = j.issues as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
  if (!issues) return base;
  const fe = issues.fieldErrors ?? {};
  const parts = Object.entries(fe).flatMap(([k, msgs]) => (msgs ?? []).map((m) => `${k}: ${m}`));
  const formErrs = issues.formErrors?.length ? issues.formErrors.join("; ") : "";
  const extra = [formErrs, ...parts].filter(Boolean).join("\n");
  return extra ? `${base}\n${extra}` : base;
}
type VendorOpt = { id: string; displayName: string; isActive?: boolean };
type CustomerOpt = { id: string; displayName: string };

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

/** Use beside currency selectors — `w-full` + flex breaks and can collapse the input to zero width */
const inputClassFlex =
  "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-600/15 transition focus:border-blue-600 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
const reqClass = "text-red-600 dark:text-red-400";

function initialFormState() {
  return {
    expenseDate: new Date().toISOString().slice(0, 10),
    expenseAccountId: "",
    bankAccountId: "",
    currency: "INR",
    amount: "",
    taxAmount: "0",
    vendorId: "",
    vendorLabel: "",
    invoiceNumber: "",
    notes: "",
    customerId: "",
    customerLabel: "",
  };
}

export function ExpenseForm() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrInitialFile, setOcrInitialFile] = useState<File | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const vendorsRef = useRef(vendors);

  const clearOcrInitial = useCallback(() => setOcrInitialFile(null), []);

  useEffect(() => {
    vendorsRef.current = vendors;
  }, [vendors]);

  useEffect(() => {
    void (async () => {
      const [aRes, vRes, cRes] = await Promise.all([
        fetch("/api/accounting/accounts", { cache: "no-store" }),
        fetch("/api/purchases/vendors", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);
      const aData = await parseResponseJson<{ accounts?: Acct[] }>(aRes, {});
      const vData = await parseResponseJson<{ vendors?: VendorOpt[] }>(vRes, {});
      const cData = await parseResponseJson<{ customers?: CustomerOpt[] }>(cRes, {});
      setAccounts((aData.accounts ?? []).filter((a) => a.isActive !== false));
      setVendors((vData.vendors ?? []).filter((v) => v.isActive !== false));
      setCustomers(cData.customers ?? []);
    })();
  }, []);

  const expenseAccts = accounts.filter((a) => a.type === "EXPENSE");
  const bankAccts = accounts.filter((a) => a.type === "ASSET");

  const applyOcrExpense = useCallback((d: OcrExtractedDocument) => {
    const taxSum = (d.cgst ?? 0) + (d.sgst ?? 0) + (d.igst ?? 0);
    const vid = bestPartyMatch(vendorsRef.current, d.partyName);
    const vlabel = vid ? vendorsRef.current.find((v) => v.id === vid)?.displayName ?? "" : "";
    setForm((f) => ({
      ...f,
      expenseDate: d.invoiceDate ?? f.expenseDate,
      amount: d.total != null ? String(d.total) : f.amount,
      taxAmount: taxSum > 0 ? String(Math.round(taxSum * 100) / 100) : f.taxAmount,
      invoiceNumber: d.invoiceNo?.trim() ? d.invoiceNo.trim().slice(0, 120) : f.invoiceNumber,
      vendorId: vid || f.vendorId,
      vendorLabel: vlabel || f.vendorLabel,
      notes:
        d.partyName && !vid
          ? `${d.partyName.slice(0, 200)}\n${f.notes}`.slice(0, 500)
          : f.notes,
    }));
    setOcrMessage("OCR data applied — verify accounts, tax, and amount before saving.");
  }, []);

  function onInputFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) {
      setOcrInitialFile(f);
      setOcrOpen(true);
    }
  }

  async function submit(navigateAway: boolean, e?: React.FormEvent) {
    e?.preventDefault();
    const amt = Number.parseFloat(String(form.amount).replace(/,/g, ""));
    if (!form.expenseAccountId || !form.bankAccountId || !Number.isFinite(amt)) {
      alert("Please fill required fields: expense account, paid through, and a valid amount.");
      return;
    }
    const taxRaw = Number.parseFloat(String(form.taxAmount || "0").replace(/,/g, ""));
    const taxAmount = Number.isFinite(taxRaw) ? taxRaw : 0;

    setSaving(true);
    try {
      const res = await fetch("/api/purchases/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          expenseDate: form.expenseDate,
          expenseAccountId: form.expenseAccountId,
          bankAccountId: form.bankAccountId,
          vendorId: form.vendorId.trim() || null,
          customerId: form.customerId.trim() || null,
          invoiceNumber: form.invoiceNumber.trim() || null,
          amount: amt,
          taxAmount,
          notes: form.notes.trim() || null,
        }),
      });
      const j = await parseResponseJson<{ error?: string; issues?: unknown }>(res, {});
      if (!res.ok) {
        alert(formatExpenseSaveError(j));
        return;
      }
      if (navigateAway) {
        router.push("/dashboard/purchases/expenses");
        router.refresh();
      } else {
        setForm(initialFormState());
        setOcrMessage(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-2 sm:px-6">
      <DocumentOcrModal
        open={ocrOpen}
        onOpenChange={setOcrOpen}
        documentType="EXPENSE"
        initialFile={ocrInitialFile}
        onInitialFileConsumed={clearOcrInitial}
        onApply={applyOcrExpense}
      />
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        <span className="border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-800 dark:border-blue-400 dark:text-blue-200">
          Record Expense
        </span>
        <button
          type="button"
          disabled
          className="cursor-not-allowed px-3 py-2 text-sm font-medium text-slate-400 opacity-60"
          title="Coming soon"
        >
          Record Mileage
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed px-3 py-2 text-sm font-medium text-slate-400 opacity-60"
          title="Coming soon"
        >
          Bulk Add Expenses
        </button>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr,minmax(280px,360px)] lg:items-start">
        <form
          className="min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
        >
          <div className="grid gap-5">
            <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
              <label className={labelClass}>
                Date <span className={reqClass}>*</span>
              </label>
              <input
                type="date"
                required
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
              <label className={`${labelClass} pt-2`}>
                Expense Account <span className={reqClass}>*</span>
              </label>
              <div>
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
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() => alert("Line itemization will be available in a future update.")}
                >
                  Itemize
                </button>
              </div>
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
              <label className={labelClass}>
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
              <div className="relative">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  list="vendor-datalist-expense"
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
                  className={`${inputClass} pr-10`}
                  autoComplete="off"
                />
                <datalist id="vendor-datalist-expense">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.displayName} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
              <label className={labelClass}>Invoice#</label>
              <input
                value={form.invoiceNumber}
                onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                className={inputClass}
                maxLength={120}
              />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start">
              <label className={`${labelClass} pt-2`}>Notes</label>
              <textarea
                rows={3}
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Max. 500 characters"
                className={`${inputClass} resize-y`}
              />
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

            <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-center">
              <label className={labelClass}>Customer Name</label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  list="customer-datalist-expense"
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
                  placeholder="Select or add a customer"
                  className={`${inputClass} pr-10`}
                  autoComplete="off"
                />
                <datalist id="customer-datalist-expense">
                  {customers.map((c) => (
                    <option key={c.id} value={c.displayName} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit(false)}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Save and New
            </button>
            <Link
              href="/dashboard/purchases/expenses"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div
          className={`rounded-xl border-2 border-dashed p-6 transition-colors lg:sticky lg:top-24 ${
            dragActive ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            onInputFiles(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-28 w-full items-center justify-center rounded-lg bg-gradient-to-b from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              <CloudUpload className="h-12 w-12 text-slate-400" strokeWidth={1} aria-hidden />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upload document (OCR)</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF, JPG, PNG · max 5MB · preview &amp; edit before apply</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setOcrOpen(true)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500"
              >
                <CloudUpload className="h-4 w-4" />
                Upload document
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                Choose file
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => onInputFiles(e.target.files)}
                />
              </label>
            </div>
            {ocrMessage ? (
              <p className="mt-4 text-left text-xs leading-relaxed text-slate-600 dark:text-slate-300">{ocrMessage}</p>
            ) : (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                OCR runs on the server and fills date, amount, invoice #, and tries to match a vendor from your list. Review
                values before saving.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
