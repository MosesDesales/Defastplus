"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DocumentTemplateTypeSlug } from "@/lib/document-template-types";
import { documentTitleForModule, parseTemplateConfigJson, templateTypeLabel } from "@/lib/document-template-types";
import { DocumentTemplatePreview, type TemplatePreviewCompany } from "@/components/settings/DocumentTemplatePreview";

type Row = {
  id: string;
  name: string;
  isDefault?: boolean;
  isDefaultForModule?: boolean;
  configJson: string;
};

function docLabelForType(type: DocumentTemplateTypeSlug): string {
  return documentTitleForModule(type);
}

export function TemplateListClient({
  type,
  company,
}: Readonly<{
  type: DocumentTemplateTypeSlug;
  company: TemplatePreviewCompany;
}>) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/settings/templates?module=${encodeURIComponent(type)}`);
    const data = (await res.json()) as { templates?: Row[]; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Could not load");
      setRows([]);
      return;
    }
    setErr(null);
    setRows(data.templates ?? []);
  }, [type]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function run(id: string, action: () => Promise<Response>) {
    setBusy(id);
    try {
      const res = await action();
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Request failed");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const previewRow = rows?.find((r) => r.id === previewId);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{templateTypeLabel(type)}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Design how PDFs and prints look. The default template is used when you create a new document unless you pick another.
          </p>
        </div>
        <Link
          href={`/settings/templates/${type}/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          + New template
        </Link>
      </div>

      {err ? <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40">{err}</div> : null}

      {rows === null ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No templates.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const cfg = parseTemplateConfigJson(t.configJson);
            return (
              <li
                key={t.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative h-[200px] overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <div className="origin-top scale-[0.42] transform p-3 sm:scale-[0.48]">
                    <DocumentTemplatePreview
                      docLabel={docLabelForType(type)}
                      docNumber="INV-00042"
                      issueDate="2026-05-01"
                      dueDate="2026-05-15"
                      company={company}
                      config={cfg}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent dark:from-slate-900/90" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setPreviewId(t.id)}
                      className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-800 shadow dark:bg-slate-800 dark:text-slate-100"
                    >
                      Preview
                    </button>
                    <Link
                      href={`/settings/templates/${type}/${t.id}/edit`}
                      className="pointer-events-auto rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white shadow"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() =>
                        run(t.id, () =>
                          fetch(`/api/settings/templates/${t.id}/duplicate`, {
                            method: "POST",
                          }),
                        )
                      }
                      className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-800 shadow dark:bg-slate-800 dark:text-slate-100"
                    >
                      Duplicate
                    </button>
                    {!t.isDefaultForModule && !t.isDefault ? (
                      <button
                        type="button"
                        disabled={busy === t.id}
                        onClick={() =>
                          run(t.id, () =>
                            fetch(`/api/settings/templates/${t.id}/set-default`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ moduleName: type }),
                            }),
                          )
                        }
                        className="pointer-events-auto rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow"
                      >
                        Set default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => {
                        if (!confirm(`Delete template “${t.name}”?`)) return;
                        void run(t.id, () =>
                          fetch(`/api/settings/templates/${t.id}`, {
                            method: "DELETE",
                          }),
                        );
                      }}
                      className="pointer-events-auto rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium text-slate-900 dark:text-white">{t.name}</h2>
                    {t.isDefaultForModule || t.isDefault ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                        ⭐ Default
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {previewId && previewRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">{previewRow.name}</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
                onClick={() => setPreviewId(null)}
              >
                Close
              </button>
            </div>
            <DocumentTemplatePreview
              docLabel={docLabelForType(type)}
              docNumber="INV-00042"
              issueDate="2026-05-01"
              dueDate="2026-05-15"
              company={company}
              config={parseTemplateConfigJson(previewRow.configJson)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
