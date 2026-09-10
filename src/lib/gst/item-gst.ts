import { isInterState } from "@/lib/gst/split";

export type ItemGstTaxModeStr = "AUTO" | "INTRA" | "INTER";

export function resolveInterStateForLine(
  mode: ItemGstTaxModeStr,
  companyGstin: string | null | undefined,
  partyGstin: string | null | undefined,
): boolean {
  if (mode === "INTER") return true;
  if (mode === "INTRA") return false;
  return isInterState(companyGstin, partyGstin);
}
