"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";

type JobRow = {
  id: string;
  status: string;
  sourceType: string;
  fileName: string | null;
  createdAt: string;
  errorSummary: string | null;
};

type JobDetail = JobRow & {
  stats: Record<string, number> | null;
  reconcile: {
    balanced?: boolean;
    mode?: string;
    summary?: { mismatches: number; totalLedgers: number; topMismatches: unknown[] };
    tallyTotalDr?: number;
    tallyTotalCr?: number;
    erpTotalDr?: number;
    erpTotalCr?: number;
  } | null;
  logs: Array<{ level: string; phase: string; message: string; createdAt: string }>;
};

export function TallyMigrationClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<JobDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phases, setPhases] = useState({ coa: true, vouchers: true, inventory: true, reconcile: true });

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/integrations/tally/migration", { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setJobs(d.jobs ?? []);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function loadJob(id: string) {
    const res = await fetch(`/api/integrations/tally/migration/${id}`, { credentials: "include" });
    if (!res.ok) return;
    const d = await res.json();
    setSelected(d.job);
  }

  async function uploadXml(file: File) {
    setBusy("upload");
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("phases", JSON.stringify(phases));
    const res = await fetch("/api/integrations/tally/migration/run", { method: "POST", body: fd, credentials: "include" });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Migration failed");
      if (data.jobId) void loadJob(data.jobId);
      return;
    }
    await loadJobs();
    if (data.jobId) await loadJob(data.jobId);
  }

  async function runFromBridge() {
    setBusy("bridge");
    setErr(null);
    const res = await fetch("/api/integrations/tally/migration/run", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "tally_api", phases }),
    });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Bridge migration failed");
      return;
    }
    await loadJobs();
    if (data.jobId) await loadJob(data.jobId);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tally → ERP Migration</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Import Chart of Accounts, vouchers, inventory, and reconcile trial balance against Tally. Upload a Tally XML export or pull from a local TallyPrime HTTP bridge (port 9000).
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload Tally XML
          <input
            type="file"
            accept=".xml,text/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadXml(f);
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void runFromBridge()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600"
        >
          {busy === "bridge" ? "Importing…" : "Import from Tally bridge"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {(["coa", "vouchers", "inventory", "reconcile"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 capitalize">
            <input
              type="checkbox"
              checked={phases[k]}
              onChange={(e) => setPhases((p) => ({ ...p, [k]: e.target.checked }))}
            />
            {k === "coa" ? "Chart of Accounts" : k}
          </label>
        ))}
      </div>

      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}

      {selected ? (
        <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold">
            Job {selected.id.slice(0, 8)}… — {selected.status}
          </p>
          {selected.stats ? (
            <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              {Object.entries(selected.stats).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          ) : null}
          {selected.reconcile ? (
            <div className={`mt-2 text-sm ${selected.reconcile.balanced ? "text-emerald-700" : "text-amber-700"}`}>
              <p>
                Trial balance ({selected.reconcile.mode ?? "closing"}):{" "}
                {selected.reconcile.balanced ? "Matched" : `${selected.reconcile.summary?.mismatches ?? "?"} mismatches`}
                {selected.reconcile.tallyTotalDr != null
                  ? ` · Tally Dr ${selected.reconcile.tallyTotalDr} / Cr ${selected.reconcile.tallyTotalCr}`
                  : ""}
              </p>
              {!selected.reconcile.balanced && selected.reconcile.summary?.topMismatches?.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium">Drill-down: top mismatches</summary>
                  <table className="mt-2 w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1">Ledger</th>
                        <th>Dr diff</th>
                        <th>Cr diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.reconcile.summary.topMismatches as Array<{ ledgerName: string; debitDiff: number; creditDiff: number }>).map(
                        (r) => (
                          <tr key={r.ledgerName} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="py-1 pr-2">{r.ledgerName}</td>
                            <td>{r.debitDiff}</td>
                            <td>{r.creditDiff}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </details>
              ) : null}
            </div>
          ) : null}
          <ul className="mt-3 max-h-40 overflow-y-auto text-xs">
            {selected.logs?.slice(0, 15).map((l) => (
              <li key={`${l.createdAt}-${l.message}`} className={l.level === "ERROR" ? "text-red-600" : "text-slate-600"}>
                [{l.phase}] {l.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent migrations</h3>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {jobs.length === 0 ? (
            <li className="py-4 text-sm text-slate-500">No migrations yet.</li>
          ) : (
            jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2 text-sm">
                <button type="button" className="text-left text-teal-600 hover:underline" onClick={() => void loadJob(j.id)}>
                  {j.fileName ?? j.sourceType} · {j.status}
                </button>
                <span className="text-xs text-slate-500">{new Date(j.createdAt).toLocaleString()}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
