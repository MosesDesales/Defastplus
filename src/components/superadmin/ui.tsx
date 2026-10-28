"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
/** Compact select for toolbars (no full-width). */
export const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

export const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        active
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
          : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  TRIAL: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  EXPIRED: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

export function SubscriptionBadge({ status }: { status: string }) {
  return (
    <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", SUB_STATUS_STYLE[status])}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          "flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none dark:bg-slate-900 sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type ToastState = { kind: "success" | "error"; message: string } | null;

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.kind === "error" ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const Icon = toast.kind === "success" ? CheckCircle2 : XCircle;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[130] sm:left-auto sm:w-96" role={toast.kind === "error" ? "alert" : "status"}>
      <div
        className={cx(
          "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
          toast.kind === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
            : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1">{toast.message}</p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
