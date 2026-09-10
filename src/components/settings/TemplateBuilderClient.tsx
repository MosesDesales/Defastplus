"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
  documentTitleForModule,
  type DocumentTemplateConfig,
  type DocumentTemplateTypeSlug,
  type TemplateColumnKey,
  templateTypeLabel,
} from "@/lib/document-template-types";
import { DocumentTemplatePreview, type TemplatePreviewCompany } from "@/components/settings/DocumentTemplatePreview";

const COLUMN_OPTIONS: { key: TemplateColumnKey; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "description", label: "Description" },
  { key: "qty", label: "Qty" },
  { key: "rate", label: "Rate" },
  { key: "tax", label: "Tax %" },
  { key: "amount", label: "Amount" },
];

const SECTION_KEYS = ["header", "documentInfo", "party", "items", "summary", "footer"] as const;

function docLabelForType(type: DocumentTemplateTypeSlug): string {
  return documentTitleForModule(type);
}

function rnd() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cf-${Date.now()}`;
}

const chk =
  "rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-offset-slate-900";
const lab = "text-sm font-medium text-slate-800 dark:text-slate-200";
const inp =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function TemplateBuilderClient({
  type,
  templateId,
  company,
}: Readonly<{
  type: DocumentTemplateTypeSlug;
  templateId: string | null;
  company: TemplatePreviewCompany;
}>) {
  const router = useRouter();
  const [config, setConfig] = useState<DocumentTemplateConfig>({ ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG });
  const [name, setName] = useState("Untitled");
  const [loading, setLoading] = useState(() => Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/settings/templates/${templateId}`);
      const data = (await res.json()) as { name?: string; config?: DocumentTemplateConfig; error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setErr(data.error ?? "Could not load template");
        setLoading(false);
        return;
      }
      if (data.name) setName(data.name);
      if (data.config) setConfig(data.config);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const docNumberSample = useMemo(() => {
    const m: Record<DocumentTemplateTypeSlug, string> = {
      quotes: "QT-1024",
      "sales-orders": "SO-2401",
      "delivery-challans": "DC-118",
      invoices: "INV-00042",
      "credit-notes": "CN-0008",
      "purchase-orders": "PO-2201",
      "payment-receipts": "RCPT-009",
      checks: "CHK-004",
      "customer-statements": "STMT-06",
      bills: "BILL-501",
      "vendor-credits": "VC-003",
      "vendor-payments": "VPAY-02",
      "vendor-statements": "VST-01",
      journals: "JV-12",
    };
    return m[type] ?? "DOC-001";
  }, [type]);

  function toggleColumn(k: TemplateColumnKey) {
    setConfig((prev) => {
      const has = prev.columns.includes(k);
      const next = has ? prev.columns.filter((c) => c !== k) : [...prev.columns, k];
      if (next.length === 0) return prev;
      return { ...prev, columns: next };
    });
  }

  function moveSection(key: string, dir: -1 | 1) {
    setConfig((prev) => {
      const order = [...(prev.sectionOrder ?? SECTION_KEYS)];
      const i = order.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= order.length) return prev;
      const o = [...order];
      [o[i], o[j]] = [o[j]!, o[i]!];
      return { ...prev, sectionOrder: o };
    });
  }

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const body = { name: name.trim() || "Untitled", config };
      const res = templateId
        ? await fetch(`/api/settings/templates/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/settings/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, ...body }),
          });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Save failed");
        return;
      }
      router.push(`/settings/templates?module=${encodeURIComponent(type)}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const onImportFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result)) as {
            type?: string;
            name?: string;
            config?: DocumentTemplateConfig;
          };
          if (raw.type && raw.type !== type) {
            setErr(`Imported file is for “${raw.type}”; switch category or change the JSON type to “${type}”.`);
            return;
          }
          if (raw.name) setName(raw.name);
          if (raw.config) {
            setConfig({ ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG, ...raw.config });
          }
          setErr(null);
        } catch {
          setErr("Invalid template JSON file.");
        }
      };
      reader.readAsText(file);
    },
    [type],
  );

  if (loading) {
    return <p className="text-sm text-slate-500">Loading template…</p>;
  }

  const order =
    config.sectionOrder?.filter((k): k is (typeof SECTION_KEYS)[number] =>
      (SECTION_KEYS as readonly string[]).includes(k),
    ) ?? [...SECTION_KEYS];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/settings/templates?module=${encodeURIComponent(type)}`} className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
            ← {templateTypeLabel(type)}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {templateId ? "Edit template" : "New template"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">
            Import JSON
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0] ?? null)} />
          </label>
          {templateId ? (
            <a
              href={`/api/settings/templates/${templateId}/export`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
            >
              Export JSON
            </a>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {err ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40">{err}</div> : null}

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <div>
            <label className={`mb-1 block ${lab}`}>Template name</label>
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Section order (drag-style)</h2>
            <p className="mt-1 text-xs text-slate-500">Reorder blocks on the printed page.</p>
            <ul className="mt-3 space-y-2">
              {order.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="capitalize text-slate-700 dark:text-slate-200">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="flex gap-1">
                    <button type="button" className="rounded border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-600" onClick={() => moveSection(key, -1)}>
                      ↑
                    </button>
                    <button type="button" className="rounded border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-600" onClick={() => moveSection(key, 1)}>
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Header</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["showLogo", "Logo"],
                  ["showCompanyName", "Company name"],
                  ["showAddress", "Address"],
                  ["showGstin", "GSTIN"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className={chk}
                    checked={config.header[k]}
                    onChange={(e) => setConfig((p) => ({ ...p, header: { ...p.header, [k]: e.target.checked } }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={`mb-1 block ${lab}`}>Alignment</label>
                <select
                  className={inp}
                  value={config.header.alignment}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      header: { ...p.header, alignment: e.target.value as DocumentTemplateConfig["header"]["alignment"] },
                    }))
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className={`mb-1 block ${lab}`}>Header font (pt)</label>
                <input
                  type="number"
                  className={inp}
                  min={8}
                  max={18}
                  value={config.header.fontSizePt}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, header: { ...p.header, fontSizePt: Math.min(18, Math.max(8, Number(e.target.value) || 11)) } }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Document info</h2>
            <div className="mt-3 flex flex-wrap gap-4">
              {(
                [
                  ["showNumber", "Number"],
                  ["showIssueDate", "Issue date"],
                  ["showDueDate", "Due date"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className={chk}
                    checked={config.documentInfo[k]}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, documentInfo: { ...p.documentInfo, [k]: e.target.checked } }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Customer / vendor block</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className={chk}
                checked={config.party.show}
                onChange={(e) => setConfig((p) => ({ ...p, party: { ...p.party, show: e.target.checked } }))}
              />
              Show party block
            </label>
            <div className="mt-3">
              <label className={`mb-1 block ${lab}`}>Block title</label>
              <input
                className={inp}
                value={config.party.label}
                onChange={(e) => setConfig((p) => ({ ...p, party: { ...p.party, label: e.target.value } }))}
                maxLength={80}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Line columns</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {COLUMN_OPTIONS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className={chk} checked={config.columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Summary</h2>
            <div className="mt-3 flex flex-wrap gap-4">
              {(
                [
                  ["showSubtotal", "Subtotal"],
                  ["showGstSplit", "GST split"],
                  ["showTotal", "Total"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className={chk}
                    checked={config.summary[k]}
                    onChange={(e) => setConfig((p) => ({ ...p, summary: { ...p.summary, [k]: e.target.checked } }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Footer</h2>
            <div className="mt-3 flex flex-wrap gap-4">
              {(
                [
                  ["showNotes", "Notes"],
                  ["showTerms", "Terms"],
                  ["showSignature", "Signature"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className={chk}
                    checked={config.footer[k]}
                    onChange={(e) => setConfig((p) => ({ ...p, footer: { ...p.footer, [k]: e.target.checked } }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className={`mb-1 block ${lab}`}>Notes (fixed text on template)</label>
                <textarea
                  className={`${inp} min-h-[72px]`}
                  value={config.footer.notes}
                  onChange={(e) => setConfig((p) => ({ ...p, footer: { ...p.footer, notes: e.target.value } }))}
                />
              </div>
              <div>
                <label className={`mb-1 block ${lab}`}>Terms &amp; conditions</label>
                <textarea
                  className={`${inp} min-h-[72px]`}
                  value={config.footer.terms}
                  onChange={(e) => setConfig((p) => ({ ...p, footer: { ...p.footer, terms: e.target.value } }))}
                />
              </div>
              <div>
                <label className={`mb-1 block ${lab}`}>Signature label</label>
                <input
                  className={inp}
                  value={config.footer.signatureLabel}
                  onChange={(e) => setConfig((p) => ({ ...p, footer: { ...p.footer, signatureLabel: e.target.value } }))}
                  maxLength={120}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Colors</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["primary", "headerBg", "tableHeaderBg", "tableBorder"] as const).map((k) => (
                <div key={k}>
                  <label className={`mb-1 block text-xs capitalize text-slate-600 dark:text-slate-400`}>{k.replace(/([A-Z])/g, " $1")}</label>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded border border-slate-200 dark:border-slate-700"
                    value={config.colors[k]}
                    onChange={(e) => setConfig((p) => ({ ...p, colors: { ...p.colors, [k]: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Custom fields</h2>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
              onClick={() =>
                setConfig((p) => ({
                  ...p,
                  customFields: [...p.customFields, { id: rnd(), label: "Field", value: "" }],
                }))
              }
            >
              + Add field
            </button>
            <ul className="mt-3 space-y-2">
              {config.customFields.map((f, idx) => (
                <li key={f.id} className="flex flex-wrap gap-2 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                  <input
                    className={`${inp} max-w-[10rem]`}
                    value={f.label}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfig((p) => ({
                        ...p,
                        customFields: p.customFields.map((x, i) => (i === idx ? { ...x, label: v } : x)),
                      }));
                    }}
                    placeholder="Label"
                  />
                  <input
                    className={`${inp} min-w-[8rem] flex-1`}
                    value={f.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfig((p) => ({
                        ...p,
                        customFields: p.customFields.map((x, i) => (i === idx ? { ...x, value: v } : x)),
                      }));
                    }}
                    placeholder="Sample value"
                  />
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        customFields: p.customFields.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <label className={`mb-1 block ${lab}`}>Body font size (preview pt)</label>
            <input
              type="number"
              className={inp}
              min={7}
              max={14}
              value={config.typography.bodyFontSizePt}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  typography: { ...p.typography, bodyFontSizePt: Math.min(14, Math.max(7, Number(e.target.value) || 9)) },
                }))
              }
            />
          </div>
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
          <DocumentTemplatePreview
            docLabel={docLabelForType(type)}
            docNumber={docNumberSample}
            issueDate="2026-05-01"
            dueDate="2026-05-15"
            company={company}
            config={config}
          />
        </div>
      </div>
    </div>
  );
}
