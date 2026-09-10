/** India GSTIN: 15 chars, state code + PAN entity + Z + checksum alphanumeric. */
const GSTIN_FULL = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return true;
  if (v.length !== 15) return false;
  return GSTIN_FULL.test(v);
}

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}
