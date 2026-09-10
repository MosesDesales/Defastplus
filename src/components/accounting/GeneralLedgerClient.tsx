"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";

type AccountOpt = { id: string; code: string; name: string; type: string };
type LedgerRow = {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type LedgerSingle = {
  mode: "single";
  account: AccountOpt;
  rows: LedgerRow[];
  closingBalance: number;
  from: string;
  to: string;
};

type LedgerAll = {
  mode: "all";
  sections: Array<{
    account: AccountOpt;
    rows: LedgerRow[];
    closingBalance: number;
  }>;
  from: string;
  to: string;
};

type LedgerState = LedgerSingle | LedgerAll | null;

const ALL_VALUE = "all";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCsv(filename: string, rows: string[][]) {
  const BOM = "\uFEFF";
  const escape = (cell: string) => {
    if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };
  const csv = BOM + rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function GeneralLedgerClient() {
  const searchParams = useSearchParams();
  const highlightCode = searchParams.get("highlight");

  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountId, setAccountId] = useState(ALL_VALUE);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerState>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/accounting/accounts", { cache: "no-store" });
      const data = (await res.json()) as { accounts?: AccountOpt[] };
      if (!cancelled) setAccounts(data.accounts ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    if (!from || !to) {
      setError("Select a date range.");
      return;
    }
    if (accountId !== ALL_VALUE && !accountId) {
      setError("Select an account or All accounts.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const p =
        accountId === ALL_VALUE
          ? new URLSearchParams({ all: "1", from, to })
          : new URLSearchParams({ accountId, from, to });
      const res = await fetch(`/api/accounting/ledger?${p}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLedger(null);
        setError((data as { error?: string }).error ?? "Could not load ledger.");
        return;
      }
      const d = data as {
        allAccounts?: boolean;
        from: string;
        to: string;
        account?: AccountOpt;
        rows?: LedgerRow[];
        closingBalance?: number;
        sections?: Array<{ account: AccountOpt; rows: LedgerRow[]; closingBalance: number }>;
      };
      if (d.allAccounts && d.sections) {
        setLedger({
          mode: "all",
          sections: d.sections,
          from: d.from,
          to: d.to,
        });
      } else if (d.account && d.rows && typeof d.closingBalance === "number") {
        setLedger({
          mode: "single",
          account: d.account,
          rows: d.rows,
          closingBalance: d.closingBalance,
          from: d.from,
          to: d.to,
        });
      } else {
        setLedger(null);
        setError("Unexpected response from server.");
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to]);

  useEffect(() => {
    if (highlightCode) return;
    if (!from || !to) return;
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const p = new URLSearchParams({ all: "1", from, to });
        const res = await fetch(`/api/accounting/ledger?${p}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLedger(null);
          setError((data as { error?: string }).error ?? "Could not load ledger.");
          return;
        }
        const d = data as {
          allAccounts?: boolean;
          from: string;
          to: string;
          sections?: Array<{ account: AccountOpt; rows: LedgerRow[]; closingBalance: number }>;
        };
        if (d.allAccounts && d.sections) {
          setLedger({ mode: "all", sections: d.sections, from: d.from, to: d.to });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [highlightCode, from, to]);

  useEffect(() => {
    if (!highlightCode) return;
    if (!from || !to || accounts.length === 0) return;
    const match = accounts.find((a) => a.code === highlightCode);
    if (!match) return;
    let cancelled = false;
    (async () => {
      setAccountId(match.id);
      setError(null);
      setLoading(true);
      try {
        const p = new URLSearchParams({ accountId: match.id, from, to });
        const res = await fetch(`/api/accounting/ledger?${p}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLedger(null);
          setError((data as { error?: string }).error ?? "Could not load ledger.");
          return;
        }
        const d = data as {
          account?: AccountOpt;
          rows?: LedgerRow[];
          closingBalance?: number;
          from: string;
          to: string;
        };
        if (d.account && d.rows && typeof d.closingBalance === "number") {
          setLedger({
            mode: "single",
            account: d.account,
            rows: d.rows,
            closingBalance: d.closingBalance,
            from: d.from,
            to: d.to,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [highlightCode, accounts, from, to]);

  function exportCsv() {
    if (!ledger) return;
    const header = ["Date", "Reference", "Description", "Debit", "Credit", "Balance"];
    if (ledger.mode === "single") {
      const body = ledger.rows.map((r) => [
        r.date.slice(0, 10),
        r.reference,
        r.description,
        r.debit.toFixed(2),
        r.credit.toFixed(2),
        r.balance.toFixed(2),
      ]);
      const safeCode = ledger.account.code.replace(/[^\w.-]+/g, "_");
      downloadCsv(`general-ledger_${safeCode}_${from}_${to}.csv`, [header, ...body]);
      return;
    }
    const flatHeader = ["Account code", "Account name", ...header];
    const body: string[][] = [];
    for (const sec of ledger.sections) {
      for (const r of sec.rows) {
        body.push([
          sec.account.code,
          sec.account.name,
          r.date.slice(0, 10),
          r.reference,
          r.description,
          r.debit.toFixed(2),
          r.credit.toFixed(2),
          r.balance.toFixed(2),
        ]);
      }
    }
    downloadCsv(`general-ledger_all-accounts_${from}_${to}.csv`, [flatHeader, ...body]);
  }

  function printLedger() {
    window.print();
  }

  function renderTable(rows: LedgerRow[]) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.date}-${r.reference}-${i}`} className="border-b border-slate-100 dark:border-slate-800">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-900 dark:text-white">{r.date.slice(0, 10)}</td>
                <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">{r.reference}</td>
                <td className="max-w-[280px] px-4 py-2.5 text-slate-700 dark:text-slate-300">{r.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">{r.debit > 0 ? fmtMoney(r.debit) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">{r.credit > 0 ? fmtMoney(r.credit) : "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900 dark:text-white">{fmtMoney(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">General ledger</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Posted activity and running balance by account (includes opening balance and prior activity).
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-0 print:shadow-none">
        <div className="sticky top-14 z-10 flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 print:static print:border-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value={ALL_VALUE}>All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
            {ledger ? (
              <>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  Excel (CSV)
                </button>
                <button
                  type="button"
                  onClick={printLedger}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  PDF / Print
                </button>
              </>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        {ledger ? (
          <div id="ledger-print" className="mt-6 space-y-10">
            {ledger.mode === "single" ? (
              <div>
                <div className="mb-4 flex flex-wrap justify-between gap-2 print:mb-6">
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {ledger.account.code} — {ledger.account.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Period {from} → {to} · Closing balance {fmtMoney(ledger.closingBalance)}
                    </p>
                  </div>
                </div>
                {renderTable(ledger.rows)}
              </div>
            ) : (
              <>
                <div className="mb-2 print:mb-4">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">All accounts</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Period {from} → {to} · {ledger.sections.length} account{ledger.sections.length === 1 ? "" : "s"}
                  </p>
                </div>
                {ledger.sections.map((sec) => (
                  <div key={sec.account.id} className="print:break-inside-avoid">
                    <div className="mb-3 mt-6 first:mt-0">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {sec.account.code} — {sec.account.name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Closing balance {fmtMoney(sec.closingBalance)}</p>
                    </div>
                    {renderTable(sec.rows)}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          !loading && (
            <p className="mt-8 text-center text-sm text-slate-500">
              Set the date range and click Apply, or wait for the default all-accounts view to load.
            </p>
          )
        )}
      </div>
    </div>
  );
}
