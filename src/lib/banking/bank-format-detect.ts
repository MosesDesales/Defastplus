/** Heuristic bank / region detection from statement header text. */

export type BankFormatGuess =
  | "HDFC"
  | "ICICI"
  | "SBI"
  | "KOTAK"
  | "AXIS"
  | "GENERIC_IN"
  | "INTERNATIONAL"
  | "UNKNOWN";

export function detectBankFormat(text: string): BankFormatGuess {
  const u = text.toUpperCase();
  if (/\bHDFC\b/.test(u) || u.includes("HDFC BANK")) return "HDFC";
  if (u.includes("ICICI") || u.includes("ICICI BANK")) return "ICICI";
  if (u.includes("STATE BANK") || /\bSBI\b/.test(u) || u.includes("SBI BANK")) return "SBI";
  if (u.includes("KOTAK")) return "KOTAK";
  if (u.includes("AXIS BANK") || /\bAXIS\b/.test(u)) return "AXIS";
  if (
    u.includes("SWIFT") ||
    u.includes("IBAN") ||
    u.includes("ROUTING NUMBER") ||
    u.includes("ABA ") ||
    u.includes("SORT CODE")
  ) {
    return "INTERNATIONAL";
  }
  if (u.includes("INR") && (u.includes("IFSC") || u.includes("GST"))) return "GENERIC_IN";
  return "UNKNOWN";
}
