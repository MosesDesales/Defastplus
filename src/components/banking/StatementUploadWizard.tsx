"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { StatementColumnMapper } from "@/components/banking/StatementColumnMapper";
import { guessMapping, headingSignature, type MappingResult, type StatementMapping } from "@/lib/banking/statement-mapping";

type Acct = { id: string; bankName: string; accountName: string };

type TxRow = {
  id: string;
  txnDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
};

type ExtractKind = "csv" | "xlsx" | "xls" | "pdf" | "image";

type ExtractResponse = {
  kind: ExtractKind;
  mime: string;
  fileName: string;
  fileSizeBytes: number;
  suggestedBank: string;
  warnings: string[];
  ocrConfidence: number | null;
  ocrEngine: string | null;
  rawTextPreview: string | null;
  tablePreview: string[][] | null;
  tableSample: string[][] | null;
  sheetNames: string[] | null;
  autoParsed: Omit<TxRow, "id">[];
  csvFullText: string | null;
};

/** Spreadsheets get a heading-mapping step; PDFs and images get the OCR text step instead. */
const tabLabels = (isTable: boolean) => ["Upload File", isTable ? "Map Columns" : "OCR Preview", "Review Transactions", "Import Summary"];

const MAPPING_STORE_PREFIX = "fastplus.statementMapping.";

function loadSavedMapping(signature: string): StatementMapping | null {
  if (!signature) return null;
  try {
    const raw = localStorage.getItem(MAPPING_STORE_PREFIX + signature);
    return raw ? (JSON.parse(raw) as StatementMapping) : null;
  } catch {
    return null;
  }
}

function saveMapping(signature: string, m: StatementMapping) {
  if (!signature) return;
  try {
    localStorage.setItem(MAPPING_STORE_PREFIX + signature, JSON.stringify(m));
  } catch {
    /* storage unavailable — mapping simply isn't remembered */
  }
}

/** Saved mapping for this heading layout (searching the top rows), else a fresh guess. */
function initialMapping(table: string[][]): StatementMapping {
  const guess = guessMapping(table);
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const saved = loadSavedMapping(headingSignature(table, i));
    if (saved && saved.headerRowIndex === i) return saved;
  }
  return guess;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withRowIds(rows: Omit<TxRow, "id">[]): TxRow[] {
  return rows.map((r) => ({ ...r, id: uid() }));
}

async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function StatementUploadWizard() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [tab, setTab] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<StatementMapping | null>(null);
  const [rememberMapping, setRememberMapping] = useState(true);
  const [editableRawText, setEditableRawText] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "include" | "reject">("skip");

  const [lastImport, setLastImport] = useState<{
    importId: string;
    imported: number;
    skippedDuplicates: number;
    duplicateHint: string | null;
    transactionIds: string[];
  } | null>(null);
  const [suggestionPreview, setSuggestionPreview] = useState<{ id: string; count: number }[]>([]);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/banking/accounts");
    const data = (await res.json()) as { accounts?: Acct[] };
    setAccounts(data.accounts ?? []);
    setAccountsLoaded(true);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length && !accountId) setAccountId(accounts[0]!.id);
  }, [accounts, accountId]);

  const tableSample = extract?.tableSample;


  useEffect(() => {
    if (extract?.rawTextPreview != null) setEditableRawText(extract.rawTextPreview);
  }, [extract?.rawTextPreview, extract?.fileName]);

  const applyExtract = useCallback(
    async (f: File, si: number) => {
      setErr(null);
      setProgress("Reading statement…");
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("sheetIndex", String(si));
        const res = await fetch("/api/banking/statements/extract", { method: "POST", body: fd });
        const data = (await res.json()) as ExtractResponse & { error?: string };
        if (!res.ok) {
          setErr(data.error ?? "Extract failed");
          setExtract(null);
          setRows([]);
          return;
        }
        setExtract(data);
        setParseWarnings(data.warnings ?? []);
        if ((data.kind === "csv" || data.kind === "xlsx" || data.kind === "xls") && data.tableSample?.length) {
          // Spreadsheet: pick the headings first (pre-filled from a saved or guessed mapping).
          setMapping(initialMapping(data.tableSample));
          setRows([]);
          setTab(1);
        } else {
          setMapping(null);
          setRows(withRowIds(data.autoParsed));
          setTab(1);
        }
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (!f) return;
      setFile(f);
      setSheetIndex(0);
      void applyExtract(f, 0);
    },
    [applyExtract],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      setSheetIndex(0);
      void applyExtract(f, 0);
    },
    [applyExtract],
  );


  const runParseFromOcr = useCallback(async () => {
    if (!editableRawText.trim()) {
      setErr("No text to parse.");
      return;
    }
    setErr(null);
    setBusy(true);
    setProgress("Parsing OCR text…");
    try {
      const res = await fetch("/api/banking/statements/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: editableRawText,
          bankHint: extract?.suggestedBank,
        }),
      });
      const data = (await res.json()) as { rows?: Omit<TxRow, "id">[]; warnings?: string[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Parse failed");
        return;
      }
      setRows(withRowIds(data.rows ?? []));
      setParseWarnings(data.warnings ?? []);
      setTab(2);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [editableRawText, extract?.suggestedBank]);


  const importRows = useCallback(async () => {
    if (!file || !rows.length || !accountId || !extract) return;
    setErr(null);
    setBusy(true);
    setProgress("Importing…");
    try {
      const fileHash = await sha256File(file);
      const res = await fetch("/api/banking/statements/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankingAccountId: accountId,
          fileName: extract.fileName,
          fileHash,
          format: extract.kind,
          duplicateMode,
          fileMime: extract.mime,
          fileSizeBytes: extract.fileSizeBytes,
          rows: rows.map((r) => ({
            txnDate: r.txnDate,
            description: r.description,
            debit: r.debit,
            credit: r.credit,
            balance: r.balance,
            reference: r.reference,
          })),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        importId?: string;
        imported?: number;
        skippedDuplicates?: number;
        duplicateHint?: string | null;
        transactionIds?: string[];
      };
      if (!res.ok) {
        setErr(data.error ?? "Import failed");
        return;
      }
      setLastImport({
        importId: data.importId ?? "",
        imported: data.imported ?? 0,
        skippedDuplicates: data.skippedDuplicates ?? 0,
        duplicateHint: data.duplicateHint ?? null,
        transactionIds: data.transactionIds ?? [],
      });
      setTab(3);
      const ids = (data.transactionIds ?? []).slice(0, 5);
      const previews: { id: string; count: number }[] = [];
      for (const id of ids) {
        const sr = await fetch(`/api/banking/suggestions?transactionId=${encodeURIComponent(id)}`);
        const sj = (await sr.json()) as { suggestions?: unknown[] };
        previews.push({ id, count: sj.suggestions?.length ?? 0 });
      }
      setSuggestionPreview(previews);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [file, rows, accountId, extract, duplicateMode]);

  const undoImport = useCallback(async () => {
    if (!lastImport?.importId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/banking/statements/import/${lastImport.importId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string; deletedTransactions?: number };
      if (!res.ok) {
        setErr(data.error ?? "Undo failed");
        return;
      }
      setLastImport(null);
      setSuggestionPreview([]);
    } finally {
      setBusy(false);
    }
  }, [lastImport?.importId]);

  const isTable = Boolean(mapping && tableSample?.length);
  const TABS = tabLabels(isTable || !extract);

  const continueFromMapping = useCallback(
    (result: MappingResult) => {
      if (!mapping || !tableSample) return;
      if (rememberMapping) saveMapping(headingSignature(tableSample, mapping.headerRowIndex), mapping);
      setRows(
        withRowIds(
          result.rows.map((r) => ({
            txnDate: r.txnDate.toISOString(),
            description: r.description,
            debit: r.debit,
            credit: r.credit,
            balance: r.balance,
            reference: r.reference,
          })),
        ),
      );
      setParseWarnings(
        result.skipped.length ? [`${result.skipped.length} row(s) without a date or amount were skipped (e.g. opening/closing balance lines).`] : [],
      );
      setTab(2);
    },
    [mapping, tableSample, rememberMapping],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === i
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {progress ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
          {progress}
        </div>
      ) : null}

      {err ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}

      {tab === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm dark:border-teal-900 dark:bg-teal-950/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Excel works best.</strong>{" "}Download the statement from your net banking as Excel (.xlsx / .xls) or CSV —
                you&apos;ll choose which heading is the date, description, debit and credit. PDF and photos also work via OCR.
              </p>
            </div>
            <a
              href="/api/banking/statements/template"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200"
            >
              <Download className="h-4 w-4" aria-hidden /> Excel template
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Bank account</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {!accountsLoaded ? <option value="">Loading accounts…</option> : null}
                {accountsLoaded && !accounts.length ? <option value="">No bank accounts yet</option> : null}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — {a.accountName}
                  </option>
                ))}
              </select>
              {accountsLoaded && !accounts.length ? (
                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                  Add a bank account first under{" "}
                  <Link href="/banking/accounts" className="font-medium underline">
                    Bank accounts
                  </Link>
                  .
                </span>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Duplicate rows</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value as typeof duplicateMode)}
              >
                <option value="skip">Skip duplicates (same date, amounts, description)</option>
                <option value="include">Import all (allow duplicates)</option>
                <option value="reject">Reject import if any duplicate</option>
              </select>
            </label>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 hover:border-teal-400 hover:bg-teal-50/30 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-teal-600"
          >
            <input type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png" className="hidden" id="stmt-file" onChange={onFileInput} />
            <FileSpreadsheet className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <label htmlFor="stmt-file" className="cursor-pointer font-medium text-teal-700 underline dark:text-teal-400">
              Choose Excel or CSV file
            </label>
            <span className="mt-1">or drop it here · .xlsx, .xls, .csv (also PDF, JPG, PNG) · max 10MB</span>
            {file ? (
              <p className="mt-3 font-mono text-xs text-slate-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          {extract ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
              <p>
                <span className="font-semibold">Detected:</span> {extract.kind.toUpperCase()} ·{" "}
                <span className="font-semibold">Bank hint:</span> {extract.suggestedBank}
              </p>
              {extract.warnings?.length ? (
                <ul className="mt-2 list-inside list-disc text-amber-800 dark:text-amber-200">
                  {extract.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 1 && isTable && mapping && tableSample ? (
        <StatementColumnMapper
          table={tableSample}
          mapping={mapping}
          onChange={setMapping}
          sheetNames={extract?.sheetNames ?? null}
          sheetIndex={sheetIndex}
          onSheetChange={(v) => {
            setSheetIndex(v);
            if (file) void applyExtract(file, v);
          }}
          remember={rememberMapping}
          onRememberChange={setRememberMapping}
          onContinue={continueFromMapping}
          busy={busy}
        />
      ) : null}

      {tab === 1 && !isTable && !extract ? (
        <p className="text-sm text-slate-500">Upload an Excel or CSV statement first, then choose its headings here.</p>
      ) : null}

      {tab === 1 && !isTable && extract ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Review extracted text. OCR is not perfect—fix obvious errors, then parse into rows. Low confidence rows should be
            checked carefully.
          </p>
          {extract?.ocrConfidence != null ? (
            <p className="text-xs text-slate-500">
              OCR confidence: {(extract.ocrConfidence * 100).toFixed(0)}% · Engine: {extract.ocrEngine ?? "—"}
            </p>
          ) : null}
          <textarea
            className="min-h-[280px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            value={editableRawText}
            onChange={(e) => setEditableRawText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runParseFromOcr()}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
            >
              Parse transactions from text
            </button>
          </div>
        </div>
      ) : null}

      {tab === 2 ? (
        <div className="space-y-4">
          {parseWarnings.length ? (
            <ul className="list-inside list-disc rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {parseWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2 text-right">Debit</th>
                  <th className="px-2 py-2 text-right">Credit</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2">Ref</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-1 py-1">
                      <input
                        className="w-[108px] rounded border border-slate-200 px-1 font-mono dark:border-slate-700 dark:bg-slate-950"
                        value={r.txnDate.slice(0, 10)}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, txnDate: `${e.target.value}T12:00:00.000Z` } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        className="w-full min-w-[160px] rounded border border-slate-200 px-1 dark:border-slate-700 dark:bg-slate-950"
                        value={r.description}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border border-slate-200 px-1 text-right dark:border-slate-700 dark:bg-slate-950"
                        value={r.debit || ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, debit: parseFloat(e.target.value) || 0 } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border border-slate-200 px-1 text-right dark:border-slate-700 dark:bg-slate-950"
                        value={r.credit || ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, credit: parseFloat(e.target.value) || 0 } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border border-slate-200 px-1 text-right dark:border-slate-700 dark:bg-slate-950"
                        value={r.balance ?? ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, balance: e.target.value === "" ? null : parseFloat(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        className="w-20 rounded border border-slate-200 px-1 dark:border-slate-700 dark:bg-slate-950"
                        value={r.reference ?? ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, reference: e.target.value || null } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        className="text-red-600 text-[10px] underline"
                        onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    txnDate: new Date().toISOString(),
                    description: "",
                    debit: 0,
                    credit: 0,
                    balance: null,
                    reference: null,
                  },
                ])
              }
            >
              Add row
            </button>
            <button
              type="button"
              disabled={busy || !rows.length || !file}
              onClick={() => void importRows()}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Import {rows.length} transactions
            </button>
          </div>
        </div>
      ) : null}

      {tab === 3 ? (
        <div className="space-y-4 text-sm">
          {lastImport ? (
            <>
              <p>
                Imported <strong>{lastImport.imported}</strong> transactions
                {lastImport.skippedDuplicates ? (
                  <>
                    {" "}
                    (skipped <strong>{lastImport.skippedDuplicates}</strong> duplicate rows)
                  </>
                ) : null}
                . Status: <strong>Imported</strong> · Reconciliation: <strong>Pending</strong>
              </p>
              {lastImport.duplicateHint ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {lastImport.duplicateHint}
                </div>
              ) : null}
              <p className="text-slate-600 dark:text-slate-400">
                Auto reconciliation suggestions use amount, date, and narration. Sample (first imported lines):
              </p>
              <ul className="list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
                {suggestionPreview.map((s) => (
                  <li key={s.id}>
                    {s.count} suggestion(s) —{" "}
                    <Link href="/banking/reconciliation" className="text-teal-700 underline dark:text-teal-400">
                      open reconciliation
                    </Link>{" "}
                    for transaction <span className="font-mono">{s.id.slice(0, 8)}…</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/banking/transactions"
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
                >
                  View transactions
                </Link>
                <Link
                  href="/banking/reconciliation"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600"
                >
                  Reconcile
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void undoImport()}
                  className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:text-red-200"
                >
                  Undo import
                </button>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Complete an import to see the summary.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
