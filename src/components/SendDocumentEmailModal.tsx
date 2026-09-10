"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type EmailAttachmentRef = { kind: "invoice" | "quote" | "bill" | "expense" | "credit-note"; id: string };

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTo: string;
  subject: string;
  defaultMessage: string;
  attachment?: EmailAttachmentRef;
};

export function SendDocumentEmailModal({
  open,
  onClose,
  defaultTo,
  subject: initialSubject,
  defaultMessage,
  attachment,
}: Readonly<Props>) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(initialSubject);
      setMessage(defaultMessage);
      setError(null);
    }
  }, [open, defaultTo, initialSubject, defaultMessage]);

  if (!open) return null;

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          text: message.trim(),
          attachment,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Send failed");
        return;
      }
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Send email</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm">
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/50 dark:text-red-200">{error}</div> : null}
          <label className="block">
            <span className="text-slate-600 dark:text-slate-400">To</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-400">Subject</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-400">Message</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {attachment ? (
            <p className="text-xs text-slate-500">A PDF copy of this document will be attached automatically.</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={sending || !to.trim()}
            onClick={() => void send()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
