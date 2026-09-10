"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Acct = { id: string; bankName: string; accountName: string };

type Txn = {
  id: string;
  txnDate: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
  mappings: { id: string; moduleType: string; amountApplied: number }[];
};

type DocRow = { id: string; label: string; open: number; total: number; status: string };
type Suggestion = {
  moduleType: string;
  moduleId: string;
  label: string;
  amount: number;
  confidence: string;
};

function flow(t: Txn) {
  return t.credit > t.debit ? t.credit : t.debit;
}

function applied(t: Txn) {
  return t.mappings.reduce((s, m) => s + m.amountApplied, 0);
}

export function BankingReconcileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [accountId, setAccountId] = useState("");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [selected, setSelected] = useState<Txn | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openInv, setOpenInv] = useState<DocRow[]>([]);
  const [openBills, setOpenBills] = useState<DocRow[]>([]);
  const [expAccts, setExpAccts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [moduleType, setModuleType] = useState<"INVOICE" | "BILL" | "EXPENSE" | "VENDOR_PAYMENT">("INVOICE");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const res = await fetch(`/api/banking/transactions?accountId=${encodeURIComponent(accountId)}&status=all`);
    const data = (await res.json()) as { transactions?: Txn[] };
    const list = data.transactions ?? [];
    setTxns(list.filter((t) => t.status !== "RECONCILED"));
    setSelected(null);
  }, [accountId]);

  useEffect(() => {
    void loadTx();
  }, [loadTx]);

  const loadOpenDocs = useCallback(async () => {
    const res = await fetch("/api/banking/open-docs");
    const data = (await res.json()) as {
      invoices?: DocRow[];
      bills?: DocRow[];
      expenseAccounts?: { id: string; code: string; name: string }[];
    };
    setOpenInv(data.invoices ?? []);
    setOpenBills(data.bills ?? []);
    setExpAccts(data.expenseAccounts ?? []);
  }, []);

  useEffect(() => {
    void loadOpenDocs();
  }, [loadOpenDocs]);

  useEffect(() => {
    if (!selected) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/banking/suggestions?transactionId=${encodeURIComponent(selected.id)}`);
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      if (!cancelled) setSuggestions(data.suggestions ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const rem = Math.max(0, flow(selected) - applied(selected));
    setAmount(rem ? rem.toFixed(2) : "");
  }, [selected]);

  function setAcct(id: string) {
    setAccountId(id);
    router.replace(`/banking/reconciliation?accountId=${encodeURIComponent(id)}`);
  }

  async function applyMatch() {
    if (!selected || !amount) return;
    if (moduleType === "EXPENSE") {
      if (!expenseAccountId) return;
    } else if (!targetId) return;

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/banking/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankingTransactionId: selected.id,
          matches: [
            {
              moduleType,
              moduleId: moduleType === "EXPENSE" ? "_" : targetId,
              amount: Number(amount),
              expenseAccountId: moduleType === "EXPENSE" ? expenseAccountId || undefined : undefined,
            },
          ],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Failed");
        return;
      }
      await loadTx();
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="font-medium">Account</span>
            <select
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={accountId}
              onChange={(e) => setAcct(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} — {a.accountName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Unreconciled bank lines</h3>
        <ul className="mt-2 max-h-[480px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {txns.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelected(t)}
                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-teal-50 dark:hover:bg-teal-950/30 ${
                  selected?.id === t.id ? "bg-teal-50 dark:bg-teal-950/40" : ""
                }`}
              >
                <span className="font-medium text-slate-900 dark:text-white">{t.description}</span>
                <span className="text-xs text-slate-500">
                  {t.txnDate.slice(0, 10)} · {t.credit > 0 ? `+${t.credit.toFixed(2)}` : `−${t.debit.toFixed(2)}`} · {t.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Match to books</h3>
        {!selected ? (
          <p className="mt-4 text-sm text-slate-500">Select a bank line on the left.</p>
        ) : (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Remaining on line:{" "}
              <strong>{(flow(selected) - applied(selected)).toFixed(2)}</strong> ({selected.credit > 0 ? "deposit" : "withdrawal"})
            </p>
            {suggestions.length ? (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Suggestions</p>
                <ul className="mt-1 space-y-1">
                  {suggestions.map((s) => (
                    <li key={s.moduleId}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-slate-100 px-2 py-1.5 text-left text-xs hover:border-teal-300 dark:border-slate-800"
                        onClick={() => {
                          setModuleType(s.moduleType as typeof moduleType);
                          setTargetId(s.moduleId);
                          setAmount(s.amount.toFixed(2));
                        }}
                      >
                        <span className="font-medium">{s.label}</span>{" "}
                        <span className="text-slate-500">
                          ₹{s.amount.toFixed(2)} · {s.confidence}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="font-medium">Match type</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={moduleType}
                onChange={(e) => {
                  setModuleType(e.target.value as typeof moduleType);
                  setTargetId("");
                }}
              >
                <option value="INVOICE">Customer invoice (deposit)</option>
                <option value="BILL">Vendor bill (withdrawal)</option>
                <option value="EXPENSE">Expense (withdrawal)</option>
                <option value="VENDOR_PAYMENT">Existing vendor payment (withdrawal)</option>
              </select>
            </label>
            {moduleType === "EXPENSE" ? (
              <label className="block text-sm">
                <span className="font-medium">Expense GL account</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {expAccts.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} · {e.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {moduleType !== "EXPENSE" && moduleType !== "VENDOR_PAYMENT" ? (
              <label className="block text-sm">
                <span className="font-medium">Document</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {(moduleType === "INVOICE" ? openInv : openBills).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} (open {d.open.toFixed(2)})
                    </option>
                  ))}
                </select>
              </label>
            ) : moduleType === "VENDOR_PAYMENT" ? (
              <label className="block text-sm">
                <span className="font-medium">Vendor payment ID</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Paste payment id from Payments made"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="font-medium">Amount to apply</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <button
              type="button"
              disabled={busy || !amount || (moduleType === "EXPENSE" ? !expenseAccountId : !targetId)}
              onClick={() => void applyMatch()}
              className="w-full rounded-xl bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Apply match & post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
