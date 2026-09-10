"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { AccountActionsCell } from "@/components/accounting/AccountActionsCell";
import { parseResponseJson } from "@/lib/parse-response-json";

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  openingBalance: number;
  isActive: boolean;
  isSystem: boolean;
};

/** Display labels aligned with common COA wording (enum remains ASSET | LIABILITY | … in DB). */
const TYPE_LABEL: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

function typeSortKey(t: string) {
  const i = TYPE_ORDER.indexOf(t as (typeof TYPE_ORDER)[number]);
  return i === -1 ? 99 : i;
}

export function ChartOfAccountsClient() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (typeFilter) p.set("type", typeFilter);
    const res = await fetch(`/api/accounting/accounts?${p.toString()}`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await parseResponseJson<{ accounts?: AccountRow[] }>(res, {});
    setRows(data.accounts ?? []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const td = typeSortKey(a.type) - typeSortKey(b.type);
      if (td !== 0) return td;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [rows, search]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Accounting</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Chart of accounts</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Account name and classification — open a row to edit details.
          </p>
        </div>
        <Link
          href="/dashboard/accounting/chart-of-accounts/new"
          className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          Add account
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              placeholder="Search name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              type="search"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:w-48"
          >
            <option value="">All types</option>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="hidden border-b border-slate-200 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex sm:items-center sm:gap-3">
          <span className="flex w-8 shrink-0 justify-center" aria-hidden />
          <span className="min-w-0 flex-1">Account name</span>
          <span className="w-28 shrink-0 text-right sm:w-32">Account type</span>
          <span className="flex w-9 shrink-0 justify-end" aria-hidden />
        </div>
        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : filteredSorted.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">No accounts match your filters.</p>
        ) : (
          <ul className="list-none">
            {filteredSorted.map((acc) => {
              const typeLabel = TYPE_LABEL[acc.type] ?? acc.type;
              const editHref = `/dashboard/accounting/chart-of-accounts/${acc.id}/edit`;
              return (
                <li
                  key={acc.id}
                  className="border-b border-slate-200 transition-colors last:border-b-0 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-violet-950/30"
                >
                  <div className="flex items-center gap-2 px-3 py-3.5 sm:gap-3">
                    <div className="flex w-8 shrink-0 justify-center">
                      {acc.isSystem ? (
                        <Lock className="h-4 w-4 text-slate-400" strokeWidth={2} aria-label="System account" />
                      ) : (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600"
                          disabled
                          aria-label="Select account"
                          title="Bulk actions coming soon"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={editHref}
                        className="text-[15px] font-normal leading-snug text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {acc.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">{acc.code}</p>
                    </div>
                    <div className="w-28 shrink-0 text-right text-[15px] leading-snug text-slate-900 dark:text-slate-100 sm:w-32">
                      {typeLabel}
                    </div>
                    <div className="flex w-9 shrink-0 justify-end">
                      <AccountActionsCell
                        accountId={acc.id}
                        code={acc.code}
                        name={acc.name}
                        typeLabel={typeLabel}
                        isActive={acc.isActive}
                        isSystem={acc.isSystem}
                        openingBalance={acc.openingBalance}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
