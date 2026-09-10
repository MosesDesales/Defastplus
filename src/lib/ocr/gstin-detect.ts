/**
 * Detect Indian GSTINs and common foreign tax registration formats in OCR text.
 */
const GSTIN_STRICT = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/gi;
/** 14–15 char PAN-like tail; avoids matching arbitrary alphanumeric runs. */
const GSTIN_RELAXED = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]{2,4})\b/g;

/** Singapore GST / UEN-style blocks (e.g. 9919SGP29004OSJ). */
const SG_GST_BLOCK = /\b(\d{4}[A-Z]{3}\d{5}[A-Z]{3})\b/gi;

const GST_REG_LABEL = /GST\s*(?:Reg(?:istration)?|IN|No\.?|#)\s*[.:]?\s*([A-Z0-9]{8,22})\b/gi;

function looksLikeGstin(s: string): boolean {
  const t = s.toUpperCase();
  if (t.length < 14 || t.length > 15) return false;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/.test(t)) return false;
  return true;
}

export function isIndianGstin15(s: string): boolean {
  const t = s.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(t);
}

export function extractGstinsFromText(block: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const u = raw.toUpperCase().trim();
    if (!looksLikeGstin(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const m of block.matchAll(GSTIN_STRICT)) add(m[1]);
  for (const m of block.matchAll(GSTIN_RELAXED)) add(m[1]);
  return out;
}

function extractSingaporeStyleIds(block: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of block.matchAll(SG_GST_BLOCK)) {
    const u = m[1]!.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function extractLabeledGstRegistrations(block: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of block.matchAll(GST_REG_LABEL)) {
    const u = m[1]!.toUpperCase().trim();
    if (u.length < 8 || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Indian GSTINs plus foreign / labelled tax IDs (stored in `partyGstin` for forms). */
export function extractAllPartyTaxIds(block: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string) => {
    const u = s.toUpperCase().trim();
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const x of extractGstinsFromText(block)) push(x);
  for (const x of extractSingaporeStyleIds(block)) push(x);
  for (const x of extractLabeledGstRegistrations(block)) push(x);
  return out;
}

export function primaryGstinFromText(block: string): string | undefined {
  const all = extractGstinsFromText(block);
  return all[0];
}
