/** Fuzzy match party display name from OCR hint to a catalog id. */
export function bestPartyMatch<T extends { id: string; displayName: string }>(
  list: T[],
  hint?: string | null,
): string {
  if (!hint?.trim()) return "";
  const h = hint.toLowerCase().replace(/\s+/g, " ").trim();
  for (const v of list) {
    const n = v.displayName.toLowerCase();
    if (h.includes(n) || (n.length >= 4 && n.includes(h.slice(0, Math.min(n.length, 16))))) {
      return v.id;
    }
  }
  let bestId = "";
  let score = 0;
  for (const v of list) {
    const words = v.displayName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    let s = 0;
    for (const w of words) {
      if (h.includes(w)) s += w.length;
    }
    if (s > score) {
      score = s;
      bestId = v.id;
    }
  }
  return score >= 4 ? bestId : "";
}
