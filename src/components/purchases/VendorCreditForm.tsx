"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Vendor = { id: string; displayName: string };

export function VendorCreditForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenseAccts, setExpenseAccts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [form, setForm] = useState({
    vendorId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    amount: "",
    reason: "",
    expenseAccountId: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [vRes, aRes] = await Promise.all([
        fetch("/api/purchases/vendors", { cache: "no-store" }),
        fetch("/api/accounting/accounts", { cache: "no-store" }),
      ]);
      const vData = await parseResponseJson<{ vendors?: Vendor[] }>(vRes, {});
      const aData = await parseResponseJson<{
        accounts?: Array<{ id: string; code: string; name: string; type: string }>;
      }>(aRes, {});
      setVendors(vData.vendors ?? []);
      setExpenseAccts((aData.accounts ?? []).filter((a) => a.type === "EXPENSE"));
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/purchases/vendor-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          issueDate: form.issueDate,
          amount: Number(form.amount),
          reason: form.reason.trim() || null,
          expenseAccountId: form.expenseAccountId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/purchases/vendor-credits");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5 px-4 pb-16 sm:px-6">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <Link href="/dashboard/purchases/vendor-credits" className="text-sm font-medium text-teal-600 dark:text-teal-400">
          ← Credits
        </Link>
        <button type="submit" disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Vendor *</span>
        <select
          required
          value={form.vendorId}
          onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Select</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Credit date</span>
        <input
          type="date"
          required
          value={form.issueDate}
          onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Amount *</span>
        <input
          type="number"
          step="0.01"
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Credit side (expense / purchase returns) *</span>
        <select
          required
          value={form.expenseAccountId}
          onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Select expense account</option>
          {expenseAccts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reason</span>
        <textarea
          rows={2}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
    </form>
  );
}
