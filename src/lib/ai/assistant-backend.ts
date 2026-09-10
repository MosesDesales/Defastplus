export type AssistantProvider = "openai" | "cursor";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ResolvedAssistantBackend =
  | { kind: "none" }
  | { kind: "openai"; apiKey: string; model: string }
  | { kind: "cursor"; apiKey: string; model: string; cwd: string };

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * `FAST_ASSISTANT_PROVIDER`: `auto` (default) prefers OpenAI when both keys exist;
 * `openai` or `cursor` forces that provider when the corresponding key is set.
 */
export function resolveAssistantBackend(): ResolvedAssistantBackend {
  const openaiKey = trimEnv("OPENAI_API_KEY");
  const cursorKey = trimEnv("CURSOR_API_KEY");
  const pref = (trimEnv("FAST_ASSISTANT_PROVIDER") ?? "auto").toLowerCase();

  const openai: ResolvedAssistantBackend | null = openaiKey
    ? {
        kind: "openai",
        apiKey: openaiKey,
        model: trimEnv("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini",
      }
    : null;

  const cwd = trimEnv("CURSOR_AGENT_LOCAL_CWD") ?? process.cwd();
  const cursor: ResolvedAssistantBackend | null = cursorKey
    ? {
        kind: "cursor",
        apiKey: cursorKey,
        model: trimEnv("CURSOR_CHAT_MODEL") ?? "composer-2",
        cwd,
      }
    : null;

  if (pref === "openai" && openai) return openai;
  if (pref === "cursor" && cursor) return cursor;
  if (pref === "auto" || pref === "") {
    if (openai) return openai;
    if (cursor) return cursor;
  }
  if (openai) return openai;
  if (cursor) return cursor;
  return { kind: "none" };
}

export function stubAssistantMessage(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hint = lastUser?.content?.slice(0, 200) ?? "";
  return [
    "FAST Assistant is ready, but no LLM provider is configured on the server yet.",
    "",
    "Choose **one** of the following and restart the app:",
    "",
    "- **OpenAI**: set `OPENAI_API_KEY` (and optionally `OPENAI_CHAT_MODEL`, e.g. `gpt-4o-mini`).",
    "- **Cursor**: set `CURSOR_API_KEY` from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations), then optionally `FAST_ASSISTANT_PROVIDER=cursor` if you also use OpenAI and want Cursor for this app.",
    "",
    "Optional: `FAST_ASSISTANT_PROVIDER=auto|openai|cursor` (default `auto` uses OpenAI when both keys are set).",
    "For Cursor local agents, optional `CURSOR_AGENT_LOCAL_CWD` sets the working directory (defaults to the server process cwd).",
    "",
    hint ? `You asked: “${hint.replace(/`/g, "'")}”` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatConversationForCursorAgent(systemPreamble: string, messages: ChatMessage[]): string {
  const parts = [systemPreamble, "", "Conversation (most recent last):", ""];
  for (const m of messages) {
    parts.push(`${m.role.toUpperCase()}:`, m.content, "");
  }
  parts.push(
    "Reply as FAST Assistant: concise, markdown where helpful, no fabricating app features the user did not ask about.",
  );
  return parts.join("\n");
}

export async function runCursorAssistantPrompt(
  fullPrompt: string,
  apiKey: string,
  model: string,
  cwd: string,
): Promise<{ text: string } | { error: string }> {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");
  try {
    const result = await Agent.prompt(fullPrompt, {
      apiKey,
      model: { id: model },
      local: { cwd },
    });
    if (result.status === "error") {
      return { error: "Cursor agent run finished with an error status." };
    }
    const text = result.result?.trim();
    if (!text) {
      return { error: "Cursor returned an empty response." };
    }
    return { text };
  } catch (e) {
    if (e instanceof CursorAgentError) {
      return { error: e.message || "Cursor agent failed to start." };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || "Cursor assistant error" };
  }
}
