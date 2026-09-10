"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Copy,
  Eye,
  FileStack,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_TEMPLATE_TYPES,
  type DocumentTemplateTypeSlug,
  documentTitleForModule,
  parseTemplateConfigJson,
  templateTypeLabel,
} from "@/lib/document-template-types";
import { DOCUMENT_TEMPLATE_PRESET_DESCRIPTIONS } from "@/lib/document-template-presets";
import { DocumentTemplatePreview, type TemplatePreviewCompany } from "@/components/settings/DocumentTemplatePreview";

type ListRow = {
  id: string;
  type: string;
  name: string;
  isDefault: boolean;
  isDefaultForModule: boolean;
  configJson: string;
  thumbnailUrl: string | null;
  exportFileNamePattern: string | null;
  updatedAt: string;
  moduleNames: string[];
};

function sampleDocNo(mod: DocumentTemplateTypeSlug): string {
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
  return m[mod] ?? "DOC-001";
}

export function TemplatesHubClient({
  initialModule,
  company,
}: Readonly<{
  initialModule: DocumentTemplateTypeSlug;
  company: TemplatePreviewCompany;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<DocumentTemplateTypeSlug>(initialModule);
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [workspacePattern, setWorkspacePattern] = useState<string>("{type}-{number}");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<ListRow | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [useForId, setUseForId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDraft, setExportDraft] = useState("");
  const [fromExistingOpen, setFromExistingOpen] = useState(false);
  const [allTemplates, setAllTemplates] = useState<{ id: string; name: string; type: string }[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = searchParams.get("module")?.trim();
    if (q && (DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(q) && q !== activeModule) {
      setActiveModule(q as DocumentTemplateTypeSlug);
    }
  }, [searchParams, activeModule]);

  const load = useCallback(async (mod: DocumentTemplateTypeSlug) => {
    const res = await fetch(`/api/settings/templates?module=${encodeURIComponent(mod)}`);
    const data = (await res.json()) as {
      templates?: ListRow[];
      workspaceDefaultExportPattern?: string;
      error?: string;
    };
    if (!res.ok) {
      setErr(data.error ?? "Could not load");
      setRows([]);
      return;
    }
    setErr(null);
    setRows(data.templates ?? []);
    if (data.workspaceDefaultExportPattern) setWorkspacePattern(data.workspaceDefaultExportPattern);
  }, []);

  useEffect(() => {
    void load(activeModule);
  }, [activeModule, load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuForId(null);
        setUseForId(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function setModule(mod: DocumentTemplateTypeSlug) {
    setActiveModule(mod);
    router.replace(`/settings/templates?module=${encodeURIComponent(mod)}`, { scroll: false });
  }

  async function run(id: string, action: () => Promise<Response>) {
    setBusy(id);
    try {
      const res = await action();
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Request failed");
        return;
      }
      await load(activeModule);
      router.refresh();
    } finally {
      setBusy(null);
      setMenuForId(null);
      setUseForId(null);
    }
  }

  async function openExportModal() {
    setExportDraft(workspacePattern);
    try {
      const res = await fetch("/api/settings/templates/workspace");
      const data = (await res.json()) as { defaultPdfExportFilenamePattern?: string };
      if (res.ok && data.defaultPdfExportFilenamePattern) setExportDraft(data.defaultPdfExportFilenamePattern);
    } catch {
      /* keep draft */
    }
    setExportOpen(true);
  }

  async function saveExportPattern() {
    const res = await fetch("/api/settings/templates/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPdfExportFilenamePattern: exportDraft.trim() || "{type}-{number}" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not save");
      return;
    }
    setWorkspacePattern(exportDraft.trim() || "{type}-{number}");
    setExportOpen(false);
  }

  async function openFromExisting() {
    const res = await fetch("/api/settings/templates?all=1");
    const data = (await res.json()) as { templates?: { id: string; name: string; type: string }[] };
    setAllTemplates(data.templates ?? []);
    setFromExistingOpen(true);
  }

  async function cloneFromExisting(sourceId: string) {
    setBusy("new");
    try {
      const dupRes = await fetch(`/api/settings/templates/${sourceId}/duplicate`, { method: "POST" });
      const dup = (await dupRes.json()) as { id?: string; error?: string };
      if (!dupRes.ok || !dup.id) {
        setErr(dup.error ?? "Duplicate failed");
        return;
      }
      const cur = await fetch(`/api/settings/templates/${dup.id}`);
      const curData = (await cur.json()) as { moduleNames?: string[] };
      const merged = [...new Set([...(curData.moduleNames ?? []), activeModule])];
      await fetch(`/api/settings/templates/${dup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleNames: merged }),
      });
      setFromExistingOpen(false);
      setNewOpen(false);
      router.push(`/settings/templates/${activeModule}/${dup.id}/edit`);
    } finally {
      setBusy(null);
    }
  }

  async function createBlank() {
    setBusy("new");
    try {
      const res = await fetch("/api/settings/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeModule, name: "Untitled" }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setErr(data.error ?? "Create failed");
        return;
      }
      setNewOpen(false);
      router.push(`/settings/templates/${activeModule}/${data.id}/edit`);
    } finally {
      setBusy(null);
    }
  }

  async function toggleModuleForTemplate(templateId: string, current: string[], mod: DocumentTemplateTypeSlug, on: boolean) {
    const next = on ? [...new Set([...current, mod])] : current.filter((x) => x !== mod);
    if (next.length === 0) {
      setErr("A template must be linked to at least one document type.");
      return;
    }
    setBusy(templateId);
    try {
      const res = await fetch(`/api/settings/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleNames: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not update mappings");
        return;
      }
      await load(activeModule);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const docLabel = useMemo(() => documentTitleForModule(activeModule), [activeModule]);
  const docNo = useMemo(() => sampleDocNo(activeModule), [activeModule]);

  return (
    <div className="flex min-h-[70vh] flex-col gap-0 lg:flex-row lg:gap-0">
      {/* Sidebar */}
      <aside className="w-full shrink-0 border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50 lg:w-56 lg:border-b-0 lg:border-r">
        <div className="sticky top-0 p-3 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Template for
          </p>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0" aria-label="Document types">
            {DOCUMENT_TEMPLATE_TYPES.map((slug) => {
              const active = activeModule === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setModule(slug)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-all lg:w-full ${
                    active
                      ? "bg-white text-teal-900 shadow-sm ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-50 dark:ring-teal-800"
                      : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-900/80"
                  }`}
                >
                  {templateTypeLabel(slug)}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Settings</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Templates</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Design PDFs and prints for {templateTypeLabel(activeModule)}. Defaults apply to new documents unless you pick
              another template.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={activeModule}
              onChange={(e) => setModule(e.target.value as DocumentTemplateTypeSlug)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {DOCUMENT_TEMPLATE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {templateTypeLabel(t)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => void openExportModal()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-700"
          >
            <Settings2 className="h-4 w-4" />
            Configure export file name
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              New template
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
            <button type="button" className="ml-3 font-semibold underline" onClick={() => setErr(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Grid */}
        {rows === null ? (
          <p className="py-16 text-center text-sm text-slate-500">Loading templates…</p>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No templates yet.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((t) => (
              <li
                key={t.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-teal-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:ring-teal-900/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnailUrl} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-2 pt-4">
                      <div className="origin-top scale-[0.38] transform sm:scale-[0.42]">
                        <DocumentTemplatePreview
                          docLabel={docLabel}
                          docNumber={docNo}
                          issueDate="2026-05-01"
                          dueDate="2026-05-15"
                          company={company}
                          config={parseTemplateConfigJson(t.configJson)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-80 dark:from-slate-900" />

                  {/* Hover actions */}
                  <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-white/95 px-3 py-2.5 opacity-0 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-slate-900/95">
                    <button
                      type="button"
                      onClick={() => setPreviewRow(t)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <Link
                      href={`/settings/templates/${activeModule}/${t.id}/edit`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-2 py-1.5 text-xs font-semibold text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <div
                      className="relative"
                      ref={menuForId === t.id ? menuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuForId((v) => (v === t.id ? null : t.id));
                          setUseForId(null);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuForId === t.id ? (
                        <div
                          className="absolute bottom-full right-0 z-20 mb-1 min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl transition dark:border-slate-700 dark:bg-slate-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => {
                              setPreviewRow(t);
                              setMenuForId(null);
                            }}
                          >
                            <Eye className="h-4 w-4 opacity-70" />
                            Preview
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUseForId((v) => (v === t.id ? null : t.id));
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <LayoutTemplate className="h-4 w-4 opacity-70" />
                                Use this template for
                              </span>
                              <ChevronDown className="h-4 w-4 -rotate-90 opacity-50" />
                            </button>
                            {useForId === t.id ? (
                              <div className="max-h-52 overflow-y-auto border-t border-slate-100 bg-slate-50/80 py-1 dark:border-slate-800 dark:bg-slate-950/80">
                                {DOCUMENT_TEMPLATE_TYPES.map((mod) => {
                                  const on = t.moduleNames.includes(mod);
                                  return (
                                    <label
                                      key={mod}
                                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-white dark:hover:bg-slate-900"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        disabled={busy === t.id}
                                        onChange={(e) =>
                                          void toggleModuleForTemplate(t.id, t.moduleNames, mod, e.target.checked)
                                        }
                                        className="rounded border-slate-300 text-teal-600"
                                      />
                                      <span>{templateTypeLabel(mod)}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                            disabled={busy === t.id}
                            onClick={() =>
                              void run(t.id, () =>
                                fetch(`/api/settings/templates/${t.id}/duplicate`, { method: "POST" }),
                              )
                            }
                          >
                            <Copy className="h-4 w-4 opacity-70" />
                            Clone
                          </button>
                          {!t.isDefaultForModule ? (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                              disabled={busy === t.id}
                              onClick={() =>
                                void run(t.id, () =>
                                  fetch(`/api/settings/templates/${t.id}/set-default`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ moduleName: activeModule }),
                                  }),
                                )
                              }
                            >
                              <Star className="h-4 w-4 opacity-70" />
                              Set as default
                            </button>
                          ) : null}
                          <a
                            href={`/api/settings/templates/${t.id}/export`}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <FileStack className="h-4 w-4 opacity-70" />
                            Export JSON
                          </a>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            disabled={busy === t.id}
                            onClick={() => {
                              if (!confirm(`Delete template “${t.name}”?`)) return;
                              void run(t.id, () =>
                                fetch(`/api/settings/templates/${t.id}`, {
                                  method: "DELETE",
                                }),
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4 opacity-70" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate font-semibold text-slate-900 dark:text-white">{t.name}</h2>
                    {t.isDefaultForModule ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {DOCUMENT_TEMPLATE_PRESET_DESCRIPTIONS[t.name] ??
                      `Used for: ${t.moduleNames
                        .slice(0, 3)
                        .map((m) => templateTypeLabel(m as DocumentTemplateTypeSlug))
                        .join(", ")}${t.moduleNames.length > 3 ? ` +${t.moduleNames.length - 3}` : ""}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview modal */}
      {previewRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal
          onClick={() => setPreviewRow(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{previewRow.name}</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium dark:border-slate-600"
                onClick={() => setPreviewRow(null)}
              >
                Close
              </button>
            </div>
            <DocumentTemplatePreview
              docLabel={docLabel}
              docNumber={docNo}
              issueDate="2026-05-01"
              dueDate="2026-05-15"
              company={company}
              config={parseTemplateConfigJson(previewRow.configJson)}
            />
          </div>
        </div>
      ) : null}

      {/* New template modal */}
      {newOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setNewOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New template</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Start from scratch or reuse an existing layout.</p>
            <div className="mt-6 space-y-2">
              <button
                type="button"
                disabled={busy === "new"}
                onClick={() => void createBlank()}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:hover:bg-teal-950/30"
              >
                Blank template
                <Plus className="h-4 w-4 text-teal-600" />
              </button>
              <button
                type="button"
                disabled={busy === "new"}
                onClick={() => {
                  void openFromExisting();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:hover:bg-teal-950/30"
              >
                From existing template
                <Copy className="h-4 w-4 text-teal-600" />
              </button>
              <button
                type="button"
                onClick={() => setErr("Template gallery is coming soon.")}
                className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-slate-200 px-4 py-3 text-left text-sm text-slate-400 dark:border-slate-700"
              >
                From gallery
                <LayoutTemplate className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-sm dark:border-slate-600"
              onClick={() => setNewOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {fromExistingOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setFromExistingOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Clone layout</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pick a template to copy. It will be linked to {templateTypeLabel(activeModule)} (you can adjust mappings later).
            </p>
            <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
              {allTemplates.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    disabled={busy === "new"}
                    onClick={() => void cloneFromExisting(x.id)}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{x.name}</span>
                    <span className="ml-2 text-xs text-slate-500">({templateTypeLabel(x.type as DocumentTemplateTypeSlug)})</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm dark:border-slate-600"
              onClick={() => setFromExistingOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Export filename modal */}
      {exportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setExportOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Export file name</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Workspace default pattern for PDF downloads. Tokens:{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{type}"}</code>,{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{number}"}</code>,{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{date}"}</code>. Per-template overrides can be
              added in the editor later.
            </p>
            <input
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={exportDraft}
              onChange={(e) => setExportDraft(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
                onClick={() => setExportOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveExportPattern()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
