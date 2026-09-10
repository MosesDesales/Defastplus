"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "pnl" | "trial-balance" | "balance-sheet";

function monthBounds() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LedgerReportClient({ mode, title }: Readonly<{ mode: Mode; title: string }>) {
  const defaults = useMemo(() => monthBounds(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [asOf, setAsOf] = useState(todayYmd());
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "";
      if (mode === "pnl") url = `/api/reports/pnl?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      else if (mode === "trial-balance")
        url = `/api/reports/trial-balance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      else url = `/api/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`;
      const res = await fetch(url, { cache: "no-store", credentials: "include" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Could not load report");
        setPayload(null);
        return;
      }
      setPayload(j);
    } catch {
      setError("Network error");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [mode, from, to, asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv(filename: string, rows: string[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleExportExcel() {
    if (!payload) return;
    if (mode === "pnl") {
      const p = payload as {
        incomeLines: { code: string; name: string; amount: number }[];
        expenseLines: { code: string; name: string; amount: number }[];
        incomeTotal: number;
        expenseTotal: number;
        netProfit: number;
      };
      const rows: string[][] = [
        ["Section", "Account", "Name", "Amount"],
        ...p.incomeLines.map((l) => ["Income", l.code, l.name, String(l.amount)]),
        ["Income", "", "Total", String(p.incomeTotal)],
        ...p.expenseLines.map((l) => ["Expense", l.code, l.name, String(l.amount)]),
        ["Expense", "", "Total", String(p.expenseTotal)],
        ["", "", "Net profit", String(p.netProfit)],
      ];
      exportCsv(`P-L-${from}-to-${to}.csv`, rows);
      return;
    }
    if (mode === "trial-balance") {
      const p = payload as { rows: { code: string; name: string; debit: number; credit: number }[]; totalDebit: number; totalCredit: number };
      const rows: string[][] = [
        ["Account", "Name", "Debit", "Credit"],
        ...p.rows.map((r) => [r.code, r.name, String(r.debit), String(r.credit)]),
        ["", "Totals", String(p.totalDebit), String(p.totalCredit)],
      ];
      exportCsv(`Trial-balance-${from}-to-${to}.csv`, rows);
      return;
    }
    const p = payload as {
      assets: { code: string; name: string; balance: number }[];
      liabilities: { code: string; name: string; balance: number }[];
      equity: { code: string; name: string; balance: number }[];
      retainedEarningsComputed: number;
      assetTotal: number;
      liabilityTotal: number;
      equityTotal: number;
    };
    const rows: string[][] = [
      ["Section", "Account", "Name", "Balance"],
      ...p.assets.map((r) => ["Asset", r.code, r.name, String(r.balance)]),
      ["Asset", "", "Total assets", String(p.assetTotal)],
      ...p.liabilities.map((r) => ["Liability", r.code, r.name, String(r.balance)]),
      ["Liability", "", "Total liabilities", String(p.liabilityTotal)],
      ...p.equity.map((r) => ["Equity", r.code, r.name, String(r.balance)]),
      ["Equity", "", "Retained (P&L cumulative)", String(p.retainedEarningsComputed)],
      ["Equity", "", "Total equity", String(p.equityTotal)],
    ];
    exportCsv(`Balance-sheet-${asOf}.csv`, rows);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 print:px-0">
      <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Figures from posted journal entries (sales, purchases, payments, manual journals).</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {mode === "balance-sheet" ? (
            <label className="text-xs text-slate-600 dark:text-slate-400">
              As of
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
          ) : (
            <>
              <label className="text-xs text-slate-600 dark:text-slate-400">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-400">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </>
          )}
          <button type="button" onClick={() => void load()} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Apply
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={handleExportExcel} disabled={!payload} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Export Excel (CSV)
        </button>
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Export PDF (print)
        </button>
      </div>

      {error ? <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40">{error}</div> : null}
      {loading ? <p className="mt-10 text-slate-500">Loading…</p> : null}

      {!loading && payload ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {mode === "pnl" ? <PnlBody data={payload as PnlData} /> : null}
          {mode === "trial-balance" ? <TbBody data={payload as TbData} /> : null}
          {mode === "balance-sheet" ? <BsBody data={payload as BsData} /> : null}
        </div>
      ) : null}
    </div>
  );
}

type PnlData = {
  incomeLines: { code: string; name: string; amount: number }[];
  expenseLines: { code: string; name: string; amount: number }[];
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
};

function PnlBody({ data }: Readonly<{ data: PnlData }>) {
  return (
    <div className="space-y-8 text-sm">
      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Income</h2>
        <table className="mt-2 w-full">
          <tbody>
            {data.incomeLines.map((r) => (
              <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  {r.code} — {r.name}
                </td>
                <td className="py-2 text-right tabular-nums">{r.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="pt-2">Total income</td>
              <td className="pt-2 text-right tabular-nums">{data.incomeTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Expenses</h2>
        <table className="mt-2 w-full">
          <tbody>
            {data.expenseLines.map((r) => (
              <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  {r.code} — {r.name}
                </td>
                <td className="py-2 text-right tabular-nums">{r.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="pt-2">Total expenses</td>
              <td className="pt-2 text-right tabular-nums">{data.expenseTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="text-lg font-semibold text-teal-800 dark:text-teal-200">
        Net profit (income − expense): {data.netProfit.toFixed(2)}
      </p>
    </div>
  );
}

type TbData = {
  rows: { code: string; name: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
};

function TbBody({ data }: Readonly<{ data: TbData }>) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-slate-500">
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Debit</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">
                {r.code} — {r.name}
              </td>
              <td className="py-2 text-right tabular-nums">{r.debit.toFixed(2)}</td>
              <td className="py-2 text-right tabular-nums">{r.credit.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="pt-3">Totals</td>
            <td className="pt-3 text-right tabular-nums">{data.totalDebit.toFixed(2)}</td>
            <td className="pt-3 text-right tabular-nums">{data.totalCredit.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={`mt-4 text-sm ${data.balanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"}`}>
        {data.balanced ? "Total debits equal total credits." : "Totals differ — review unposted or out-of-period entries."}
      </p>
    </div>
  );
}

type BsData = {
  assets: { code: string; name: string; balance: number }[];
  liabilities: { code: string; name: string; balance: number }[];
  equity: { code: string; name: string; balance: number }[];
  retainedEarningsComputed: number;
  assetTotal: number;
  liabilityTotal: number;
  equityTotal: number;
  liabilitiesAndEquity: number;
  equationOk: boolean;
};

function BsBody({ data }: Readonly<{ data: BsData }>) {
  return (
    <div className="space-y-8 text-sm">
      <Section title="Assets" rows={data.assets} total={data.assetTotal} />
      <Section title="Liabilities" rows={data.liabilities} total={data.liabilityTotal} />
      <div>
        <h2 className="text-sm font-semibold">Equity</h2>
        <table className="mt-2 w-full">
          <tbody>
            {data.equity.map((r) => (
              <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  {r.code} — {r.name}
                </td>
                <td className="py-2 text-right tabular-nums">{r.balance.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 italic">Retained earnings (cumulative P&amp;L)</td>
              <td className="py-2 text-right tabular-nums">{data.retainedEarningsComputed.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="pt-2">Total equity</td>
              <td className="pt-2 text-right tabular-nums">{data.equityTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Liabilities + equity: {data.liabilitiesAndEquity.toFixed(2)} · Assets: {data.assetTotal.toFixed(2)}
        {data.equationOk ? " (balanced)" : " (check data — equation not satisfied)"}
      </p>
    </div>
  );
}

function Section({ title, rows, total }: Readonly<{ title: string; rows: { code: string; name: string; balance: number }[]; total: number }>) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <table className="mt-2 w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">
                <a href={`/dashboard/accounting/general-ledger?highlight=${encodeURIComponent(r.code)}`} className="text-teal-700 hover:underline dark:text-teal-400">
                  {r.code}
                </a>{" "}
                — {r.name}
              </td>
              <td className="py-2 text-right tabular-nums">{r.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="pt-2">Total</td>
            <td className="pt-2 text-right tabular-nums">{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
