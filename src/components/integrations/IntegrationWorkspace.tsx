"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { parseResponseJson } from "@/lib/parse-response-json";
import type { IntegrationSlug } from "@/lib/integrations/slug";
import type { IntegrationConfig } from "@/lib/integrations/default-config";
import type { SyncScopes } from "@/lib/integrations/default-config";

type Mapping = {
  accounts: { app: string; external: string }[];
  taxRates: { app: string; external: string }[];
  items: { app: string; external: string }[];
};

type IntegrationState = {
  id: string | null;
  status: string;
  lastSyncAt: string | null;
  autoSync: boolean;
  config: IntegrationConfig;
  mapping: Mapping;
};

const scopeLabels: { key: keyof SyncScopes; label: string; group: "masters" | "transactions" }[] = [
  { key: "chartOfAccounts", label: "Chart of Accounts", group: "masters" },
  { key: "customers", label: "Customers", group: "masters" },
  { key: "vendors", label: "Vendors", group: "masters" },
  { key: "items", label: "Items", group: "masters" },
  { key: "salesInvoices", label: "Sales (Invoices)", group: "transactions" },
  { key: "purchaseBills", label: "Purchases (Bills)", group: "transactions" },
  { key: "payments", label: "Payments", group: "transactions" },
  { key: "journals", label: "Journals", group: "transactions" },
];

function cx(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export function IntegrationWorkspace({
  slug,
  title,
  subtitle,
  variant,
}: Readonly<{
  slug: IntegrationSlug;
  title: string;
  subtitle: string;
  variant: "tally" | "zoho" | "quickbooks";
}>) {
  const [data, setData] = useState<IntegrationState | null>(null);
  const [logs, setLogs] = useState<{ id: string; module: string; status: string; errorMessage: string | null; syncedAt: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [xmlPreview, setXmlPreview] = useState<string | null>(null);

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthRedirect, setOauthRedirect] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, lRes] = await Promise.all([
      fetch(`/api/integrations/${slug}`, { credentials: "include" }),
      fetch(`/api/integrations/logs?type=${encodeURIComponent(slug)}&limit=50`, { credentials: "include" }),
    ]);
    const dJson = await parseResponseJson<{ integration?: IntegrationState }>(dRes, {});
    const lJson = await parseResponseJson<{ logs?: typeof logs }>(lRes, {});
    if (dRes.ok && dJson.integration) {
      setData(dJson.integration);
      if (variant !== "tally") {
        setOauthRedirect(dJson.integration.config.zohoRedirectUrl ?? "");
      }
    }
    if (lRes.ok && lJson.logs) setLogs(lJson.logs);
    setLoading(false);
  }, [slug, variant]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const connected = data?.status === "CONNECTED";

  async function persistSnapshot(merged: IntegrationState) {
    const res = await fetch(`/api/integrations/${slug}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: merged.config,
        mapping: merged.mapping,
        autoSync: merged.autoSync,
      }),
    });
    if (!res.ok) setToast("Could not save settings.");
    else setToast("Settings saved.");
  }

  function setScope(key: keyof SyncScopes, v: boolean) {
    setData((prev) => {
      if (!prev) return prev;
      const merged: IntegrationState = {
        ...prev,
        config: { ...prev.config, scopes: { ...prev.config.scopes, [key]: v } },
      };
      void persistSnapshot(merged);
      return merged;
    });
  }

  function setMappingRow(section: keyof Mapping, index: number, field: "app" | "external", value: string) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev.mapping);
      if (copy[section][index]) copy[section][index][field] = value;
      const merged = { ...prev, mapping: copy };
      void persistSnapshot(merged);
      return merged;
    });
  }

  function addMappingRow(section: keyof Mapping) {
    setData((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev.mapping);
      copy[section].push({ app: "", external: "" });
      const merged = { ...prev, mapping: copy };
      void persistSnapshot(merged);
      return merged;
    });
  }

  async function connectDisconnect(connect: boolean) {
    setBusy(connect ? "connect" : "disconnect");
    const cred: Record<string, unknown> = {};
    if (connect && variant === "zoho") {
      cred.clientId = oauthClientId.trim();
      cred.clientSecret = oauthClientSecret.trim();
    }
    if (connect && variant === "quickbooks") {
      cred.clientId = oauthClientId.trim();
      cred.clientSecret = oauthClientSecret.trim();
    }
    const res = await fetch("/api/integrations/connect", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: slug,
        action: connect ? "connect" : "disconnect",
        credentials: Object.keys(cred).length ? cred : undefined,
        config: data?.config,
        mapping: data?.mapping,
      }),
    });
    const j = await parseResponseJson<{ error?: string }>(res, {});
    setBusy(null);
    if (!res.ok) {
      setToast(j.error ?? "Request failed");
      return;
    }
    setToast(connect ? "Connected." : "Disconnected.");
    await load();
  }

  async function syncNow() {
    setBusy("sync");
    setXmlPreview(null);
    const res = await fetch("/api/integrations/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: slug }),
    });
    const j = await parseResponseJson<{ ok?: boolean; message?: string; detail?: string; error?: string }>(res, {});
    setBusy(null);
    setToast(j.message ?? (j.ok ? "Sync finished" : "Sync failed"));
    if (variant === "tally" && j.detail) setXmlPreview(j.detail);
    await load();
  }

  async function testTally() {
    setBusy("test");
    setXmlPreview(null);
    const res = await fetch("/api/integrations/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: slug, test: true }),
    });
    const j = await parseResponseJson<{ ok?: boolean; message?: string; error?: string }>(res, {});
    setBusy(null);
    setToast(j.message ?? "Test complete");
    await load();
  }

  async function refreshTokenStub() {
    setToast("Token refresh is not wired in this build — use Disconnect and Connect again when tokens expire.");
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast ? (
        <div className="fixed left-1/2 top-20 z-[70] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {toast}
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
      </div>

      {/* A. Connection status */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Connection</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span
            className={cx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
              connected ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
            )}
          >
            <span aria-hidden>{connected ? "🟢" : "🔴"}</span>
            {connected ? "Connected" : "Not connected"}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Last sync: {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : "—"}
          </span>
        </div>

        {variant === "tally" ? (
          <label className="mt-4 block max-w-xl text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Tally bridge URL</span>
            <input
              value={data.config.tallyUrl ?? ""}
              onChange={(e) =>
                setData((d) => (d ? { ...d, config: { ...d.config, tallyUrl: e.target.value } } : d))
              }
              onBlur={() => {
                setData((d) => {
                  if (!d) return d;
                  void persistSnapshot(d);
                  return d;
                });
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="http://localhost:9000"
            />
          </label>
        ) : null}

        {variant === "zoho" ? (
          <div className="mt-4 grid max-w-xl gap-3">
            <label className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Client ID</span>
              <input
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                autoComplete="off"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Client secret</span>
              <input
                type="password"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                autoComplete="off"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Redirect URL</span>
              <input
                value={oauthRedirect}
                onChange={(e) => {
                  setOauthRedirect(e.target.value);
                  setData((d) =>
                    d ? { ...d, config: { ...d.config, zohoRedirectUrl: e.target.value } } : d,
                  );
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">OAuth consent and token exchange run server-side only in production.</p>
          </div>
        ) : null}

        {variant === "quickbooks" ? (
          <div className="mt-4 grid max-w-xl gap-3">
            <label className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Intuit Client ID</span>
              <input
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Client secret</span>
              <input
                type="password"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {connected ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void connectDisconnect(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void connectDisconnect(true)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {variant === "zoho" ? "Connect to Zoho" : variant === "quickbooks" ? "Connect to QuickBooks" : "Connect"}
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void syncNow()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sync now
          </button>
          {variant === "tally" ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void testTally()}
              className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-200 dark:hover:bg-sky-950/40"
            >
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test connection
            </button>
          ) : null}
          {variant === "zoho" ? (
            <button
              type="button"
              onClick={() => void refreshTokenStub()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh token
            </button>
          ) : null}
        </div>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={data.autoSync}
            onChange={(e) => {
              const v = e.target.checked;
              setData((d) => (d ? { ...d, autoSync: v } : d));
              void fetch(`/api/integrations/${slug}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ autoSync: v }),
              }).then(() => setToast(v ? "Auto sync enabled (scheduler not running in dev)." : "Auto sync off."));
            }}
            className="rounded border-slate-300 text-teal-600"
          />
          Auto sync
        </label>
      </section>

      {variant === "tally" && xmlPreview ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">XML response (snippet)</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-white p-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">{xmlPreview}</pre>
        </section>
      ) : null}

      {/* C. Sync scope */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sync scope</h2>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Masters</p>
            <ul className="mt-2 space-y-2">
              {scopeLabels
                .filter((s) => s.group === "masters")
                .map((s) => (
                  <li key={s.key}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.config.scopes[s.key]}
                        onChange={(e) => setScope(s.key, e.target.checked)}
                        className="rounded border-slate-300 text-teal-600"
                      />
                      {s.label}
                    </label>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Transactions</p>
            <ul className="mt-2 space-y-2">
              {scopeLabels
                .filter((s) => s.group === "transactions")
                .map((s) => (
                  <li key={s.key}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.config.scopes[s.key]}
                        onChange={(e) => setScope(s.key, e.target.checked)}
                        className="rounded border-slate-300 text-teal-600"
                      />
                      {s.label}
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      {/* D. Mapping */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Data mapping</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Map FAST entities to external codes used by {title}.</p>

        {(["accounts", "taxRates", "items"] as const).map((section) => (
          <div key={section} className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{section}</h3>
              <button
                type="button"
                onClick={() => addMappingRow(section)}
                className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
              >
                + Add row
              </button>
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left dark:bg-slate-800/80">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">FAST</th>
                    <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">→ External</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mapping[section].map((row, i) => (
                    <tr key={`${section}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1">
                        <input
                          value={row.app}
                          onChange={(e) => setMappingRow(section, i, "app", e.target.value)}
                          className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 dark:hover:border-slate-600"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.external}
                          onChange={(e) => setMappingRow(section, i, "external", e.target.value)}
                          className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 dark:hover:border-slate-600"
                          placeholder="External code"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Logs */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sync logs</h2>
          <button type="button" onClick={() => void load()} className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Refresh
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-left dark:border-slate-700">
              <tr>
                <th className="py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Date</th>
                <th className="py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Module</th>
                <th className="py-2 pr-4 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="py-2 font-medium text-slate-600 dark:text-slate-400">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No log entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{new Date(l.syncedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.module}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          l.status === "SUCCESS"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">{l.errorMessage ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Background queue (BullMQ) can replace inline sync — this build writes logs synchronously from API routes.
        </p>
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Credentials are encrypted at rest. All outbound vendor calls must stay on the server in production.
      </p>
    </div>
  );
}
