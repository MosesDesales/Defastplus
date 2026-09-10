"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type ExpensePayload = {
  expenseDate: string;
  amount: number;
  taxAmount: number;
  notes: string | null;
  posted: boolean;
  expenseAccount: { code: string; name: string };
  bankAccount: { code: string; name: string };
};

export function ExpenseDetailClient({ id }: Readonly<{ id: string }>) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExpensePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/purchases/expenses/${id}`, { cache: "no-store" });
      const j = await parseResponseJson<{ expense?: ExpensePayload }>(res, {});
      if (!cancelled) {
        setData(res.ok && j.expense ? j.expense : null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="px-4 py-12 text-center text-slate-500">Loading…</p>;

  if (!data)
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-slate-600 dark:text-slate-400">
        Expense not found or you don&apos;t have access.
      </div>
    );

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 print:py-4">
      <Link href="/dashboard/purchases/expenses" className="text-sm font-medium text-teal-600 print:hidden dark:text-teal-400">
        ← Expenses
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">Expense detail</h1>
      <dl className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Date</dt>
          <dd className="font-medium">{data.expenseDate}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Expense account</dt>
          <dd>
            {data.expenseAccount.code} — {data.expenseAccount.name}
          </dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Paid through</dt>
          <dd>
            {data.bankAccount.code} — {data.bankAccount.name}
          </dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Amount</dt>
          <dd className="tabular-nums">{fmt(data.amount)}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Tax</dt>
          <dd className="tabular-nums">{fmt(data.taxAmount)}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Posted</dt>
          <dd>{data.posted ? "Yes" : "No"}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-slate-500">Description</dt>
          <dd className="whitespace-pre-wrap">{data.notes?.trim() || "—"}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="mt-8 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold print:hidden dark:border-slate-600"
        onClick={() => window.print()}
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
