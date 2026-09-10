import { NextResponse } from "next/server";
import { z } from "zod";
import {
  formatConversationForCursorAgent,
  resolveAssistantBackend,
  runCursorAssistantPrompt,
  stubAssistantMessage,
  type ChatMessage,
} from "@/lib/ai/assistant-backend";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(12_000),
});

const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).max(50),
});

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to use the AI assistant.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { messages } = parsed.data;
  const backend = resolveAssistantBackend();

  if (backend.kind === "none") {
    const msgs: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    return NextResponse.json({
      role: "assistant" as const,
      content: stubAssistantMessage(msgs),
      mode: "stub" as const,
    });
  }

  const systemPreamble = [
    "You are FAST Assistant, an in-app helper for FAST accounting software (India-focused: GST, invoices, purchases, inventory, payroll).",
    "Be concise, accurate, and practical. If the user asks for actions that change data, explain they should use the relevant screen in the app.",
    `The signed-in user's display name is ${session.name}.`,
  ].join(" ");

  if (backend.kind === "cursor") {
    const fullPrompt = formatConversationForCursorAgent(
      systemPreamble,
      messages.map((m) => ({ role: m.role, content: m.content })),
    );
    const out = await runCursorAssistantPrompt(fullPrompt, backend.apiKey, backend.model, backend.cwd);
    if ("error" in out) {
      return NextResponse.json({ error: out.error, code: "CURSOR_ERROR" }, { status: 502 });
    }
    return NextResponse.json({ role: "assistant" as const, content: out.text, mode: "cursor" as const });
  }

  const openaiMessages = [
    { role: "system" as const, content: systemPreamble },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${backend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: backend.model,
        messages: openaiMessages,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    const raw = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!res.ok) {
      const msg = raw.error?.message ?? `OpenAI error (${res.status})`;
      return NextResponse.json({ error: msg, code: "OPENAI_ERROR" }, { status: 502 });
    }

    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "Empty model response", code: "OPENAI_EMPTY" }, { status: 502 });
    }

    return NextResponse.json({ role: "assistant" as const, content: text, mode: "openai" as const });
  } catch (e) {
    console.error("ai/chat", e);
    return NextResponse.json({ error: "Could not reach AI provider", code: "OPENAI_NETWORK" }, { status: 502 });
  }
}
