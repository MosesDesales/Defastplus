/** First two characters of GSTIN are state code. */
export function gstStateCode(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2).toUpperCase();
}

export function isInterState(companyGstin: string | null | undefined, otherGstin: string | null | undefined): boolean {
  const a = gstStateCode(companyGstin);
  const b = gstStateCode(otherGstin);
  if (!a || !b) return false;
  return a !== b;
}

/**
 * Split a line tax amount into CGST/SGST (intra-state) or IGST (inter-state).
 * Intra: equal split of tax (common for GST).
 */
export function splitGstTax(taxAmount: number, interState: boolean): { cgst: number; sgst: number; igst: number } {
  const t = Math.round(taxAmount * 100) / 100;
  if (interState) {
    return { cgst: 0, sgst: 0, igst: t };
  }
  const half = Math.round((t / 2) * 100) / 100;
  return { cgst: half, sgst: Math.round((t - half) * 100) / 100, igst: 0 };
}

/** Prefer stored CGST/SGST/IGST on a line when present; otherwise split `lineTax` by place of supply. */
export function resolvedLineGstComponents(
  line: { lineTax: number; lineCgst: number; lineSgst: number; lineIgst: number },
  interState: boolean,
): { cgst: number; sgst: number; igst: number } {
  const cgst = Number(line.lineCgst);
  const sgst = Number(line.lineSgst);
  const igst = Number(line.lineIgst);
  if (cgst + sgst + igst > 0) return { cgst, sgst, igst };
  return splitGstTax(Number(line.lineTax), interState);
}

export function yearMonthFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
