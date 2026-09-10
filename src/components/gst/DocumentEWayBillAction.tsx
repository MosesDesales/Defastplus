"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  previewUrl: string;
  createUrl: string;
  documentNumber: string;
  label?: string;
  createBody?: Record<string, unknown>;
};

export function DocumentEWayBillAction({
  previewUrl,
  createUrl,
  documentNumber,
  label = "E-Way Bill",
  createBody,
}: Props) {
  const router = useRouter();
  const [suggested, setSuggested] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch(previewUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.automation?.suggested) {
          setSuggested(true);
          setReasons(d.automation.reasons ?? []);
        }
      })
      .catch(() => {});
  }, [previewUrl]);

  const create = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(createUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody ?? {}),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Could not create E-Way Bill");
      return;
    }
    router.push(`/dashboard/gst/eway-bills/${data.bill.id}`);
  }, [createUrl, createBody, router]);

  return (
    <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">{label}</p>
          {suggested ? (
            <ul className="mt-1 list-inside list-disc text-xs text-teal-800 dark:text-teal-200">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-teal-800 dark:text-teal-200">Generate an E-Way Bill for this document.</p>
          )}
          {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/gst/eway-bills"
            className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 dark:border-teal-800"
          >
            Dashboard
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : `E-Way for ${documentNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}
