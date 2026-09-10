import { INDIAN_STATES } from "@/lib/org-profile-constants";
import { INDIAN_STATE_CODES } from "@/lib/ocr/label-synonyms";
import { gstStateCode } from "@/lib/gst/split";

const ALPHA_TO_NUMERIC: Record<string, string> = {
  AN: "35",
  AP: "37",
  AR: "12",
  AS: "18",
  BR: "10",
  CH: "04",
  CG: "22",
  DN: "26",
  DL: "07",
  GA: "30",
  GJ: "24",
  HR: "06",
  HP: "02",
  JK: "01",
  JH: "20",
  KA: "29",
  KL: "32",
  LA: "38",
  LD: "31",
  MP: "23",
  MH: "27",
  MN: "14",
  ML: "17",
  MZ: "15",
  NL: "13",
  OR: "21",
  PY: "34",
  PB: "03",
  RJ: "08",
  SK: "11",
  TN: "33",
  TS: "36",
  TR: "16",
  UP: "09",
  UT: "05",
  WB: "19",
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NAME_TO_NUMERIC: Record<string, string> = {};
for (const [code, name] of Object.entries(INDIAN_STATE_CODES)) {
  NAME_TO_NUMERIC[normalizeKey(name)] = code;
}
for (const s of INDIAN_STATES) {
  NAME_TO_NUMERIC[normalizeKey(s.name)] = ALPHA_TO_NUMERIC[s.code] ?? NAME_TO_NUMERIC[normalizeKey(s.name)] ?? "";
  NAME_TO_NUMERIC[normalizeKey(s.code)] = ALPHA_TO_NUMERIC[s.code] ?? "";
}

/** Resolve 2-digit GST state code from GSTIN, alpha code, or state name. */
export function resolveNumericStateCode(opts: {
  gstin?: string | null;
  stateNameOrCode?: string | null;
}): string | null {
  const fromGstin = gstStateCode(opts.gstin);
  if (fromGstin && /^\d{2}$/.test(fromGstin)) return fromGstin;

  const raw = opts.stateNameOrCode?.trim();
  if (!raw) return null;
  if (/^\d{2}$/.test(raw)) return raw;
  if (raw.length === 2 && ALPHA_TO_NUMERIC[raw.toUpperCase()]) return ALPHA_TO_NUMERIC[raw.toUpperCase()]!;

  const key = normalizeKey(raw);
  return NAME_TO_NUMERIC[key] ?? null;
}

export function stateNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return INDIAN_STATE_CODES[code] ?? null;
}

export function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && String(p).trim()).join(", ");
}
