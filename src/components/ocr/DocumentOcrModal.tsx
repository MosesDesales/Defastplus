"use client";

import { FileScan, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { lowConfidenceWarning } from "@/lib/ocr/low-confidence";
import { inferMimeFromFilename } from "@/lib/ocr/infer-mime";
import type { OcrDocumentType, OcrExtractedDocument, OcrExtractedLineItem, OcrFieldHighlight } from "@/lib/ocr/types";
import { isAllowedOcrMime, OCR_MAX_BYTES } from "@/lib/ocr/types";

type Step = "idle" | "uploading" | "processing" | "review" | "error";

function partyLabel(t: OcrDocumentType): string {
  if (t === "INVOICE") return "Customer / buyer";
  if (t === "BILL") return "Vendor / supplier";
  return "Merchant";
}

function emptyDraft(): OcrExtractedDocument {
  return {
    items: [],
    warnings: [],
  };
}

function fieldHighlightClass(draft: OcrExtractedDocument, field: OcrFieldHighlight): string {
  return draft.meta?.highlightFields?.includes(field)
    ? "ring-1 ring-amber-400 border-amber-400 dark:border-amber-500"
    : "";
}

function confidenceBadge(conf?: number): string {
  if (conf == null || conf <= 0) return "";
  const pct = Math.round(conf * 100);
  if (pct >= 75) return ` (${pct}%)`;
  if (pct >= 55) return ` (${pct}% — review)`;
  return ` (${pct}% — low confidence)`;
}

function fieldBorder(conf: number | undefined, highlighted: boolean): string {
  if (highlighted) return "ring-1 ring-amber-400 border-amber-400 dark:border-amber-500";
  if (conf != null && conf > 0 && conf < 0.55) return "border-amber-400 dark:border-amber-500";
  return "border-slate-200 dark:border-slate-600";
}

export function DocumentOcrModal({
  open,
  onOpenChange,
  documentType,
  onApply,
  initialFile,
  onInitialFileConsumed,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: OcrDocumentType;
  onApply: (data: OcrExtractedDocument) => void;
  /** When set while opening, this file is processed immediately (e.g. drag-drop on parent). */
  initialFile?: File | null;
  onInitialFileConsumed?: () => void;
}>) {
  const [step, setStep] = useState<Step>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<OcrExtractedDocument>(emptyDraft);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInitialKey = useRef<string | null>(null);
  const prevOpen = useRef(false);

  const reset = useCallback(() => {
    setStep("idle");
    setErr(null);
    setDraft(emptyDraft());
    setEngine(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewMime(null);
    }
  }, [previewUrl]);

  /* eslint-disable react-hooks/set-state-in-effect -- sync modal state when dialog opens/closes */
  useEffect(() => {
    if (!open) {
      lastInitialKey.current = null;
      reset();
      prevOpen.current = false;
      return;
    }
    if (!prevOpen.current) {
      setStep("idle");
      setErr(null);
      setDraft(emptyDraft());
      setEngine(null);
    }
    prevOpen.current = true;
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const runFile = useCallback(
    async (file: File) => {
      setErr(null);
      if (file.size > OCR_MAX_BYTES) {
        setErr("File must be 20MB or smaller.");
        setStep("error");
        return;
      }
      const mime = (() => {
        const browser = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";
        if (isAllowedOcrMime(browser)) return browser;
        return inferMimeFromFilename(file.name) ?? browser;
      })();
      if (!isAllowedOcrMime(mime)) {
        setErr("Only PDF, JPG, or PNG files are supported.");
        setStep("error");
        return;
      }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setPreviewMime(mime);

      setStep("uploading");
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("documentType", documentType);
        const up = await fetch("/api/ocr/upload", { method: "POST", body: fd, credentials: "include" });
        const upJson = (await up.json()) as { id?: string; error?: string };
        if (!up.ok) {
          setErr(upJson.error ?? "Upload failed");
          setStep("error");
          return;
        }
        setStep("processing");
        const pr = await fetch("/api/ocr/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: upJson.id }),
        });
        const prJson = (await pr.json()) as {
          extracted?: OcrExtractedDocument;
          error?: string;
          engine?: string;
          fieldConfidence?: OcrExtractedDocument["fieldConfidence"];
        };
        if (!pr.ok) {
          setErr(prJson.error ?? "OCR processing failed");
          setStep("error");
          return;
        }
        setDraft({
          ...(prJson.extracted ?? { items: [], warnings: [] }),
          fieldConfidence: prJson.fieldConfidence ?? prJson.extracted?.fieldConfidence,
        });
        setEngine(prJson.engine ?? null);
        setStep("review");
      } catch {
        setErr("Network error");
        setStep("error");
      }
    },
    [documentType],
  );

  useEffect(() => {
    if (!open || !initialFile) return;
    const key = `${initialFile.name}-${initialFile.size}-${initialFile.lastModified}`;
    if (lastInitialKey.current === key) return;
    lastInitialKey.current = key;
    void runFile(initialFile);
    onInitialFileConsumed?.();
  }, [open, initialFile, runFile, onInitialFileConsumed]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void runFile(f);
  };

  const confWarn = lowConfidenceWarning(draft);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="ocr-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileScan className="h-5 w-5 text-teal-600" />
            <h2 id="ocr-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Upload document · OCR
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {step === "idle" || step === "error" ? (
            <div
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                step === "error" ? "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void runFile(f);
                  e.target.value = "";
                }}
              />
              <p className="text-center text-sm font-medium text-slate-800 dark:text-slate-100">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-slate-500">PDF, JPG, PNG · max 20MB · Indian GST field detection</p>
              {step === "error" && err ? <p className="mt-4 max-w-md text-center text-sm text-red-700 dark:text-red-300">{err}</p> : null}
            </div>
          ) : null}

          {(step === "uploading" || step === "processing") && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {step === "uploading" ? "Uploading…" : "Processing OCR…"}
              </p>
              <p className="text-xs text-slate-500">Google Vision (if configured) or Tesseract / PDF text extraction</p>
            </div>
          )}

          {step === "review" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Document</p>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                  {previewUrl && previewMime?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Upload preview" className="max-h-[420px] w-full object-contain" />
                  ) : previewUrl && previewMime === "application/pdf" ? (
                    <iframe title="PDF preview" src={previewUrl} className="h-[420px] w-full bg-white" />
                  ) : null}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Extracted data (editable)</p>
                {confWarn ? (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {confWarn}
                  </p>
                ) : null}
                {draft.warnings?.length ? (
                  <ul className="mb-3 list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
                    {draft.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                {draft.meta?.duplicateInvoiceId || draft.meta?.duplicateBillNumber || draft.meta?.duplicateExpenseKey ? (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    Possible duplicate document detected — confirm before saving.
                  </p>
                ) : null}
                {engine ? (
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
                    OCR engine: {engine}
                    {draft.confidence != null ? ` · confidence ${(draft.confidence * 100).toFixed(0)}%` : ""}
                  </p>
                ) : null}
                {draft.supplyIsInterState !== undefined ? (
                  <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                    Detected supply: <strong>{draft.supplyIsInterState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong>
                  </p>
                ) : null}

                <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {partyLabel(documentType)}
                      {confidenceBadge(draft.fieldConfidence?.partyName)}
                    </label>
                    <input
                      className={`mt-1 w-full rounded-lg bg-white px-2 py-1.5 text-sm ${fieldBorder(draft.fieldConfidence?.partyName, false)} dark:bg-slate-950`}
                      value={draft.partyName ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, partyName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Tax ID / GSTIN
                      {confidenceBadge(draft.fieldConfidence?.partyGstin)}
                    </label>
                    <input
                      className={`mt-1 w-full rounded-lg bg-white px-2 py-1.5 text-sm dark:bg-slate-950 ${fieldHighlightClass(draft, "partyGstin")} ${fieldBorder(draft.fieldConfidence?.partyGstin, draft.meta?.highlightFields?.includes("partyGstin") ?? false)}`}
                      value={draft.partyGstin ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, partyGstin: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">PO #</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.purchaseOrderNo ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, purchaseOrderNo: e.target.value || undefined }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">E-Way Bill</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.ewayBillNo ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, ewayBillNo: e.target.value || undefined }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Place of supply</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      value={draft.placeOfSupply ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, placeOfSupply: e.target.value || undefined }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Invoice #</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.invoiceNo ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, invoiceNo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Date</label>
                      <input
                        type="date"
                        className={`mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 ${fieldHighlightClass(draft, "invoiceDate")}`}
                        value={draft.invoiceDate ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, invoiceDate: e.target.value || undefined }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Due date</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      value={draft.dueDate ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value || undefined }))}
                    />
                  </div>
                  <div className={`grid grid-cols-3 gap-2 ${fieldHighlightClass(draft, "tax")}`}>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">CGST</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.cgst ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, cgst: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">SGST</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.sgst ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, sgst: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">IGST</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        value={draft.igst ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, igst: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Total
                      {confidenceBadge(draft.fieldConfidence?.total)}
                    </label>
                    <input
                      className={`mt-1 w-full rounded-lg bg-white px-2 py-1.5 text-sm dark:bg-slate-950 ${fieldHighlightClass(draft, "total")} ${fieldBorder(draft.fieldConfidence?.total, draft.meta?.highlightFields?.includes("total") ?? false)}`}
                      value={draft.total ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, total: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Line items</p>
                <div
                  className={`mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700 ${fieldHighlightClass(draft, "items")}`}
                >
                  {draft.items.map((row, idx) => (
                    <LineEditor
                      key={idx}
                      row={row}
                      onChange={(next) =>
                        setDraft((d) => ({
                          ...d,
                          items: d.items.map((it, i) => (i === idx ? next : it)),
                        }))
                      }
                      onRemove={() =>
                        setDraft((d) => ({
                          ...d,
                          items: d.items.filter((_, i) => i !== idx),
                        }))
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        items: [...d.items, { name: "", qty: 1, rate: 0, taxPercent: 18 }],
                      }))
                    }
                  >
                    + Add line
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {step === "review" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-600"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              onClick={() => {
                onApply({ ...draft, items: draft.items.filter((l) => l.name.trim().length > 0) });
                onOpenChange(false);
              }}
            >
              Confirm &amp; apply to form
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LineEditor({
  row,
  onChange,
  onRemove,
}: Readonly<{
  row: OcrExtractedLineItem;
  onChange: (r: OcrExtractedLineItem) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="grid gap-1 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800/80 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
      <input
        className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-950"
        placeholder="Description"
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
      />
      <input
        className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-950"
        placeholder="HSN/SAC"
        value={row.hsnSac ?? ""}
        onChange={(e) => onChange({ ...row, hsnSac: e.target.value || undefined })}
      />
      <input
        className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-950"
        placeholder="Qty"
        inputMode="decimal"
        value={String(row.qty)}
        onChange={(e) => onChange({ ...row, qty: Number.parseFloat(e.target.value) || 0 })}
      />
      <input
        className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-950"
        placeholder="Rate"
        inputMode="decimal"
        value={String(row.rate)}
        onChange={(e) => onChange({ ...row, rate: Number.parseFloat(e.target.value) || 0 })}
      />
      <input
        className="rounded border border-slate-200 px-1 py-1 dark:border-slate-600 dark:bg-slate-950"
        placeholder="Tax %"
        inputMode="decimal"
        value={row.taxPercent != null ? String(row.taxPercent) : ""}
        onChange={(e) =>
          onChange({
            ...row,
            taxPercent: e.target.value === "" ? undefined : Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0)),
          })
        }
      />
      <button type="button" className="text-red-600 hover:underline" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
