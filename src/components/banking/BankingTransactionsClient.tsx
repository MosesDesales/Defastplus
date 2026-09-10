"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Acct = { id: string; bankName: string; accountName: string; currentBalance: number; unreconciledCount: number };

type Txn = {
  id: string;
  txnDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  status: string;
  mappings: { id: string; moduleType: string; amountApplied: number }[];
};

function statusStyle(s: string) {
  if (s === "RECONCILED") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
  if (s === "PARTIALLY_MAPPED") return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function BankingTransactionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [accountId, setAccountId] = useState("");
  const [rows, setRows] = useState<Txn[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/banking/accounts");
    const data = (await res.json()) as { accounts?: Acct[] };
    setAccounts(data.accounts ?? []);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const q = searchParams.get("accountId");
    if (q) setAccountId(q);
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get("accountId") && accounts.length && !accountId) {
      setAccountId(accounts[0]!.id);
    }
  }, [accounts, accountId, searchParams]);

  const loadTx = useCallback(async () => {
    if (!accountId) return;
    const res = await fetch(`/api/banking/transactions?accountId=${encodeURIComponent(accountId)}`);
    const data = (await res.json()) as { transactions?: Txn[]; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Failed");
      setRows([]);
      return;
    }
    setErr(null);
    setRows(data.transactions ?? []);
  }, [accountId]);

  useEffect(() => {
    void loadTx();
  }, [loadTx]);

  function setAccount(id: string) {
    setAccountId(id);
    router.replace(`/banking/transactions?accountId=${encodeURIComponent(id)}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Account</span>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={accountId}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.accountName} (unreconciled {a.unreconciledCount})
              </option>
            ))}
          </select>
        </label>
        {accountId ? (
          <Link
            href={`/banking/reconciliation?accountId=${encodeURIComponent(accountId)}`}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Reconcile
          </Link>
        ) : null}
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {!accountId ? (
        <p className="text-sm text-slate-500">Choose a bank account.</p>
      ) : rows === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Withdrawal</th>
                <th className="px-3 py-2 text-right">Deposit</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">{t.txnDate.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-slate-900 dark:text-white">{t.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.debit ? t.debit.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.credit ? t.credit.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{t.balance != null ? t.balance.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle(t.status)}`}>{t.status.replace("_", " ")}</span>
                    {t.mappings.length ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {t.mappings.map((m) => (
                          <div key={m.id}>
                            {m.moduleType} ₹{m.amountApplied.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
