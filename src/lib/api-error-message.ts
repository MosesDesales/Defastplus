type ZodFlattenShape = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[] | undefined;
};

/** Build a user-visible message from a typical API JSON error body. */
export function summarizeApiErrorBody(
  data: unknown,
  opts: { status: number; rawBodySnippet?: string },
): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    const issues = o.issues as ZodFlattenShape | undefined;
    if (issues?.fieldErrors) {
      const parts: string[] = [];
      for (const [field, msgs] of Object.entries(issues.fieldErrors)) {
        if (!Array.isArray(msgs)) continue;
        for (const m of msgs) {
          if (m) parts.push(`${field}: ${m}`);
        }
      }
      if (parts.length) return parts.join(" ");
    }
    if (issues?.formErrors?.length) {
      return issues.formErrors.filter(Boolean).join(" ");
    }
  }
  const hint =
    opts.status >= 500
      ? "Server error. If you use SQLite, run `npx prisma db push` so the schema matches (including FixedAsset)."
      : `Request failed (${opts.status}).`;
  const raw = opts.rawBodySnippet?.trim();
  if (raw && !raw.startsWith("{") && raw.length < 400) {
    return `${hint} Response: ${raw.slice(0, 280)}`;
  }
  return hint;
}
