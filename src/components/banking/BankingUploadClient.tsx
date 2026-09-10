"use client";

import { useCallback, useEffect, useState } from "react";

type Acct = { id: string; bankName: string; accountName: string };

export function BankingUploadClient() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fileName, setFileName] = useState("statement.csv");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<
    { txnDate: string; description: string; debit: number; credit: number; balance: number | null; reference: string | null }[] | null
  >(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/banking/accounts");
    const data = (await res.json()) as { accounts?: { id: string; bankName: string; accountName: string }[] };
    const list = data.accounts ?? [];
    setAccounts(list);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length && !accountId) setAccountId(accounts[0]!.id);
  }, [accounts, accountId]);

  async function parse() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/banking/statements/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = (await res.json()) as { rows?: typeof preview; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Parse failed");
        setPreview(null);
        return;
      }
      setPreview(data.rows ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function sha256(text: string): Promise<string> {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function importRows() {
    if (!preview?.length || !accountId) return;
    setErr(null);
    setBusy(true);
    try {
      const fileHash = await sha256(`${accountId}|${fileName}|${csvText}`);
      const res = await fetch("/api/banking/statements/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankingAccountId: accountId,
          fileName,
          fileHash,
          format: "csv",
          rows: preview,
        }),
      });
      const data = (await res.json()) as { error?: string; imported?: number };
      if (!res.ok) {
        setErr(data.error ?? "Import failed");
        return;
      }
      setCsvText("");
      setPreview(null);
      alert(`Imported ${data.imported ?? preview.length} rows.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Paste CSV exported from your bank (columns: Date, Description, Debit, Credit, optional Balance / Reference). Excel: save
        as CSV first.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Bank account</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.accountName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">File name (for duplicate detection)</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">CSV contents</span>
        <textarea
          className="mt-1 min-h-[200px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Date,Description,Debit,Credit,Balance..."
        />
      </label>
      {err ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !csvText.trim()}
          onClick={() => void parse()}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
        >
          Preview parse
        </button>
        <button
          type="button"
          disabled={busy || !preview?.length}
          onClick={() => void importRows()}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Import
        </button>
      </div>
      {preview ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.txnDate.slice(0, 10)}</td>
                  <td className="px-2 py-1.5">{r.description}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.debit ? r.debit.toFixed(2) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.credit ? r.credit.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 50 ? <p className="p-2 text-xs text-slate-500">Showing first 50 of {preview.length} rows.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
