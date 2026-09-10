"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type Vendor = { id: string; displayName: string };
type BillOpt = { id: string; billNumber: string; balance: number };

export function PaymentForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<BillOpt[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [form, setForm] = useState({
    vendorId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    mode: "BANK" as "CASH" | "BANK" | "UPI" | "CARD" | "OTHER",
    reference: "",
    memo: "",
    bankAccountId: "",
    billId: "",
    amount: "",
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
      setAccounts((aData.accounts ?? []).filter((a) => a.type === "ASSET"));
    })();
  }, []);

  useEffect(() => {
    if (!form.vendorId) {
      setBills([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/purchases/bills?vendorId=${encodeURIComponent(form.vendorId)}`, {
        cache: "no-store",
      });
      const data = await parseResponseJson<{
        bills?: Array<{ id: string; billNumber: string; balance: number }>;
      }>(res, {});
      setBills(
        (data.bills ?? []).filter((b) => b.balance > 0.005).map((b) => ({
          id: b.id,
          billNumber: b.billNumber,
          balance: b.balance,
        })),
      );
    })();
  }, [form.vendorId]);

  useEffect(() => {
    const b = bills.find((x) => x.id === form.billId);
    if (b) setForm((f) => ({ ...f, amount: b.balance.toFixed(2) }));
  }, [form.billId, bills]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.billId) {
      alert("Select a bill to pay.");
      return;
    }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      alert("Enter amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          paymentDate: form.paymentDate,
          mode: form.mode,
          reference: form.reference.trim() || null,
          memo: form.memo.trim() || null,
          bankAccountId: form.bankAccountId,
          amount: amt,
          allocations: [{ billId: form.billId, amount: amt }],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not save.");
        return;
      }
      router.push("/dashboard/purchases/payments-made");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5 px-4 pb-16 sm:px-6">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <Link href="/dashboard/purchases/payments-made" className="text-sm font-medium text-teal-600 dark:text-teal-400">
          ← Payments
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
          onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value, billId: "" }))}
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
        <span className="text-sm font-medium">Apply to bill *</span>
        <select
          required
          value={form.billId}
          onChange={(e) => setForm((f) => ({ ...f, billId: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Select bill with balance</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>
              {b.billNumber} (balance {b.balance.toFixed(2)})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Payment date</span>
        <input
          type="date"
          required
          value={form.paymentDate}
          onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
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
        <span className="text-sm font-medium">Pay from *</span>
        <select
          required
          value={form.bankAccountId}
          onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Select bank/cash</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Mode</span>
        <select
          value={form.mode}
          onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as typeof form.mode }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="BANK">Bank</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reference</span>
        <input
          value={form.reference}
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Memo</span>
        <textarea
          rows={2}
          value={form.memo}
          onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
    </form>
  );
}
