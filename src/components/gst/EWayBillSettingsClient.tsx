"use client";

import { useCallback, useEffect, useState } from "react";

export function EWayBillSettingsClient() {
  const [form, setForm] = useState({
    enabled: true,
    valueThresholdInr: 50000,
    autoSuggestInterstate: true,
    autoSuggestOverThreshold: true,
    gspProvider: "sandbox",
    sandboxMode: true,
    username: "",
    password: "",
    gstin: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/gst/eway-bills/settings", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load settings");
      return;
    }
    const data = await res.json();
    setForm((f) => ({
      ...f,
      enabled: data.enabled,
      valueThresholdInr: data.valueThresholdInr,
      autoSuggestInterstate: data.autoSuggestInterstate,
      autoSuggestOverThreshold: data.autoSuggestOverThreshold,
      gspProvider: data.gspProvider,
      sandboxMode: data.sandboxMode,
    }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/gst/eway-bills/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        valueThresholdInr: form.valueThresholdInr,
        autoSuggestInterstate: form.autoSuggestInterstate,
        autoSuggestOverThreshold: form.autoSuggestOverThreshold,
        gspProvider: form.gspProvider,
        sandboxMode: form.sandboxMode,
        credentials: {
          username: form.username || undefined,
          password: form.password || undefined,
          gstin: form.gstin || undefined,
        },
      }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setMsg("Settings saved. API credentials are stored encrypted.");
    setForm((f) => ({ ...f, password: "" }));
  }

  return (
    <form onSubmit={(e) => void save(e)} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">E-Way Bill Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Automation rules and GSP API credentials (encrypted at rest).</p>
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
        Enable E-Way Bill module
      </label>

      <label className="block text-sm">
        Value threshold (INR)
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-slate-950"
          value={form.valueThresholdInr}
          onChange={(e) => setForm((f) => ({ ...f, valueThresholdInr: Number(e.target.value) }))}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.autoSuggestOverThreshold}
          onChange={(e) => setForm((f) => ({ ...f, autoSuggestOverThreshold: e.target.checked }))}
        />
        Auto-suggest when invoice value exceeds threshold
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.autoSuggestInterstate}
          onChange={(e) => setForm((f) => ({ ...f, autoSuggestInterstate: e.target.checked }))}
        />
        Auto-suggest for inter-state movement
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.sandboxMode}
          onChange={(e) => setForm((f) => ({ ...f, sandboxMode: e.target.checked }))}
        />
        Sandbox mode (mock EBN — no live NIC calls)
      </label>

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">GSP credentials</legend>
        <p className="mb-3 text-xs text-slate-500">Leave password blank to keep existing secret.</p>
        <div className="grid gap-3">
          <input
            placeholder="GSP username"
            className="rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <input
            type="password"
            placeholder="GSP password"
            className="rounded border px-2 py-1.5 text-sm dark:bg-slate-950"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <input
            placeholder="Organization GSTIN"
            className="rounded border px-2 py-1.5 text-sm uppercase dark:bg-slate-950"
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
          />
        </div>
      </fieldset>

      <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
        Save settings
      </button>
    </form>
  );
}
