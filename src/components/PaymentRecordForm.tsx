"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

type CustomerOpt = { id: string; displayName: string };

type OpenInv = {
  id: string;
  invoiceNumber: string;
  total: number;
  balance: number;
  status: string;
};

export function PaymentRecordForm({
  customers,
  defaultPaymentDate,
}: Readonly<{
  customers: CustomerOpt[];
  defaultPaymentDate: string;
}>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(defaultPaymentDate);
  const [mode, setMode] = useState<"BANK" | "UPI" | "CASH" | "CARD" | "OTHER">("BANK");
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInv[]>([]);

  useEffect(() => {
    if (!customerId) {
      setOpenInvoices([]);
      setInvoiceId("");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/invoices?customerId=${encodeURIComponent(customerId)}&status=SENT,PARTIALLY_PAID`,
      );
      const data = (await res.json()) as { invoices?: OpenInv[] };
      if (!cancelled && data.invoices) {
        const owing = data.invoices.filter((i) => i.balance > 0.005);
        setOpenInvoices(owing);
        if (owing.length === 1) {
          setInvoiceId(owing[0].id);
          setAmount(String(owing[0].balance.toFixed(2)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    const inv = openInvoices.find((i) => i.id === invoiceId);
    if (inv && !amount) {
      setAmount(inv.balance.toFixed(2));
    }
  }, [invoiceId, openInvoices, amount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!customerId || !invoiceId || !Number.isFinite(amt) || amt <= 0) {
      setError("Customer, invoice, and amount are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          paymentDate,
          mode,
          reference: reference.trim() || null,
          amount: amt,
          allocations: [{ invoiceId, amount: amt }],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save payment");
        return;
      }
      router.push("/dashboard/sales/payments-received");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-lg space-y-4">
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50">{error}</div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Customer *</label>
        <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
          <option value="">Select customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Apply to invoice *</label>
        <select
          required
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          className={inputClass}
          disabled={!customerId || openInvoices.length === 0}
        >
          <option value="">{customerId ? "Select open invoice" : "Choose customer first"}</option>
          {openInvoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.invoiceNumber} — balance {i.balance.toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Payment date *</label>
          <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mode *</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputClass}>
            <option value="BANK">Bank</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Amount *</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Reference</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
