"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CsvColumnMap } from "@/lib/banking/parse-csv";
import { detectCsvDelim, splitCsvLine } from "@/lib/banking/parse-csv";

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

const TABS = ["Upload File", "OCR Preview", "Parsed Transactions", "Import Summary"] as const;

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

function guessColumnMap(headers: (string | undefined)[]): CsvColumnMap {
  const H = headers.map((h) => (h ?? "").trim().toLowerCase());
  const findIdx = (test: (s: string) => boolean): number | null => {
    const i = H.findIndex(test);
    return i >= 0 ? i : null;
  };
  const date =
    findIdx((s) => /date|value\s*dt|txn|transaction|posting/i.test(s)) ??
    findIdx((s) => s === "date") ??
    0;
  const description =
    findIdx((s) => /narrat|particular|description|details|remarks/i.test(s)) ?? Math.min(1, Math.max(0, H.length - 1));
  const debit = findIdx((s) => /debit|withdraw|dr\.?|paid out/i.test(s));
  const credit = findIdx((s) => /credit|deposit|cr\.?|paid in/i.test(s));
  const amount = debit == null && credit == null ? findIdx((s) => /amount|^amt$/i.test(s)) : null;
  const balance = findIdx((s) => /balance|closing/i.test(s));
  const reference = findIdx((s) => /ref|chq|cheque|utr|transaction id/i.test(s));
  if (debit != null || credit != null) {
    return {
      date,
      description,
      debit: debit ?? undefined,
      credit: credit ?? undefined,
      balance: balance ?? undefined,
      reference: reference ?? undefined,
    };
  }
  return {
    date,
    description,
    amount: amount ?? Math.min(2, Math.max(0, H.length - 1)),
    balance: balance ?? undefined,
    reference: reference ?? undefined,
  };
}

function suggestHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const joined = (matrix[i] ?? []).join(" ").toLowerCase();
    if (/date|value|txn|narrat|debit|credit|balance|particular/i.test(joined)) return i;
  }
  return 0;
}

export function StatementUploadWizard() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [accountId, setAccountId] = useState("");
  const [tab, setTab] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [columnMap, setColumnMap] = useState<CsvColumnMap | null>(null);
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
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length && !accountId) setAccountId(accounts[0]!.id);
  }, [accounts, accountId]);

  const tableSample = extract?.tableSample;

  useEffect(() => {
    if (!tableSample?.length) return;
    if (extract?.kind !== "xlsx" && extract?.kind !== "xls") return;
    const hi = suggestHeaderRow(tableSample);
    setHeaderRowIndex(hi);
    const headers = tableSample[hi] ?? [];
    setColumnMap(guessColumnMap(headers));
  }, [tableSample, extract?.kind, extract?.fileName, sheetIndex]);

  useEffect(() => {
    if (extract?.kind !== "csv") return;
    const src = extract.csvFullText ?? extract.rawTextPreview;
    if (!src) return;
    const firstLine = src.split(/\r?\n/).find((l) => l.trim().length > 0);
    if (!firstLine) return;
    const delim = detectCsvDelim(firstLine);
    const headers = splitCsvLine(firstLine, delim);
    setColumnMap(guessColumnMap(headers));
  }, [extract?.kind, extract?.csvFullText, extract?.rawTextPreview]);

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
        setProgress("Extracting transactions…");
        setExtract(data);
        setRows(withRowIds(data.autoParsed));
        setParseWarnings(data.warnings ?? []);
        setProgress("Matching records…");
        await new Promise((r) => setTimeout(r, 200));
        setProgress(null);
        if (data.kind === "pdf" || data.kind === "image") setTab(1);
        else if (data.kind === "xlsx" || data.kind === "xls") setTab(2);
        else setTab(2);
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

  const needsExcelParse = extract?.kind === "xlsx" || extract?.kind === "xls";

  const runParseFromTable = useCallback(async () => {
    if (!tableSample?.length || columnMap == null) {
      setErr("Select columns for Excel import.");
      return;
    }
    setErr(null);
    setBusy(true);
    setProgress("Parsing table…");
    try {
      const res = await fetch("/api/banking/statements/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: tableSample,
          headerRowIndex,
          columnMap,
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
  }, [tableSample, columnMap, headerRowIndex]);

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

  const runParseCsvRemap = useCallback(async () => {
    const csvText = extract?.csvFullText ?? extract?.rawTextPreview;
    if (!csvText?.trim() || !columnMap) {
      setErr("Need CSV text and column map.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/banking/statements/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, columnMap }),
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
    }
  }, [extract?.csvFullText, extract?.rawTextPreview, columnMap]);

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

  const headerOptions = useMemo(() => {
    if (!tableSample?.length) return [];
    return tableSample.slice(0, 30).map((_, i) => i);
  }, [tableSample]);

  const headerCells = tableSample?.[headerRowIndex] ?? [];

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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Drag and drop a bank statement (CSV, XLSX, XLS, PDF, JPG, PNG). Maximum file size 10MB.
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
            <input type="file" accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png" className="hidden" id="stmt-file" onChange={onFileInput} />
            <label htmlFor="stmt-file" className="cursor-pointer text-teal-700 underline dark:text-teal-400">
              Choose file
            </label>
            <span className="mt-2">or drop it here</span>
            {file ? (
              <p className="mt-3 font-mono text-xs text-slate-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          {extract?.sheetNames && extract.sheetNames.length > 1 ? (
            <label className="block text-sm">
              <span className="font-medium">Sheet</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={sheetIndex}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSheetIndex(v);
                  if (file) void applyExtract(file, v);
                }}
              >
                {extract.sheetNames.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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

      {tab === 1 ? (
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
          {needsExcelParse && tableSample?.length ? (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold">Excel column mapping</h3>
              <p className="text-xs text-slate-500">First 10 rows preview. Set header row and column indices (0-based).</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  Header row index
                  <select
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                    value={headerRowIndex}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setHeaderRowIndex(v);
                      const hdr = tableSample[v] ?? [];
                      setColumnMap(guessColumnMap(hdr));
                    }}
                  >
                    {headerOptions.map((i) => (
                      <option key={i} value={i}>
                        Row {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {columnMap ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["date", "description", "debit", "credit", "amount", "balance", "reference"] as const).map((key) => (
                    <label key={key} className="text-xs capitalize">
                      {key}
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        value={columnMap[key] ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value;
                          setColumnMap((prev) => {
                            if (!prev) return prev;
                            const next = { ...prev };
                            if (v === "") delete next[key];
                            else (next as Record<string, number>)[key] = parseInt(v, 10);
                            return next;
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="overflow-x-auto rounded border border-slate-100 dark:border-slate-800">
                <table className="w-full min-w-[480px] text-left text-[10px]">
                  <tbody>
                    {tableSample.slice(0, 10).map((r, ri) => (
                      <tr key={ri} className={ri === headerRowIndex ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                        {r.slice(0, 12).map((c, ci) => (
                          <td key={ci} className="border-b border-slate-100 px-1 py-0.5 dark:border-slate-800">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={busy || !columnMap}
                onClick={() => void runParseFromTable()}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              >
                Apply mapping & parse
              </button>
            </div>
          ) : null}

          {extract?.kind === "csv" && columnMap ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold">CSV column mapping</h3>
              <p className="text-xs text-slate-500 mb-2">Adjust indices if headers were not detected correctly.</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {(["date", "description", "debit", "credit", "amount", "balance", "reference"] as const).map((key) => (
                  <label key={key} className="text-xs capitalize">
                    {key}
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                      value={columnMap[key] ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        setColumnMap((prev) => {
                          if (!prev) return prev;
                          const next = { ...prev };
                          if (v === "") delete next[key];
                          else (next as Record<string, number>)[key] = parseInt(v, 10);
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runParseCsvRemap()}
                className="mt-3 rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Re-parse CSV with mapping
              </button>
            </div>
          ) : null}

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
