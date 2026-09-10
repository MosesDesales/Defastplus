"use client";

import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant" | "system";

type ChatMessage = { id: string; role: Role; content: string };

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m-${Date.now()}`;
}

const STORAGE_OPEN = "fast_ai_chat_open";

export function GlobalAiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi — I'm **FAST Assistant**. Ask about GST, invoices, templates, or where to find things in the app. Your messages are sent to the server only when you press send.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const v = sessionStorage.getItem(STORAGE_OPEN);
        if (v === "1") setOpen(true);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_OPEN, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const payload = {
        messages: [...messages, userMsg].filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { role?: string; content?: string; error?: string; code?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setError(null);
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: "Please **sign in** to use the AI assistant. You can still browse the marketing site without it.",
            },
          ]);
        } else {
          setError(data.error ?? "Something went wrong");
        }
        return;
      }
      if (data.content) {
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.content! }]);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="fast-ai-chat-panel"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-lg ring-2 ring-white/30 transition hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/50 dark:ring-slate-900/50 dark:focus-visible:ring-teal-500/40"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <Sparkles className="h-7 w-7" aria-hidden />}
      </button>

      <div
        id="fast-ai-chat-panel"
        role="dialog"
        aria-modal="false"
        aria-label="FAST AI assistant"
        className={`fixed bottom-24 right-5 z-[1000] flex w-[min(100vw-2.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 ${
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
        style={{ maxHeight: "min(70vh, 32rem)" }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3 text-white dark:border-slate-700">
          <MessageCircle className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">FAST Assistant</p>
            <p className="text-[11px] text-teal-100">AI · All pages</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-white/10"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="min-h-[200px] flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: "min(42vh, 22rem)" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {m.role === "assistant" ? <AssistantMarkdown text={m.content} /> : <span className="whitespace-pre-wrap">{m.content}</span>}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Thinking…
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="border-t border-slate-100 px-3 py-2 text-xs text-red-600 dark:border-slate-800">{error}</p> : null}

        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything…"
              className="max-h-28 min-h-[2.5rem] w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </>
  );
}

/** Minimal safe formatting for assistant stub (bold, newlines). */
function AssistantMarkdown({ text }: Readonly<{ text: string }>) {
  const parts = text.split("\n");
  return (
    <div className="space-y-1.5">
      {parts.map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          <LineWithBold line={line} />
        </p>
      ))}
    </div>
  );
}

function LineWithBold({ line }: Readonly<{ line: string }>) {
  const segments = line.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {segments.map((s, j) => (j % 2 === 1 ? <strong key={j}>{s}</strong> : <span key={j}>{s}</span>))}
    </>
  );
}
