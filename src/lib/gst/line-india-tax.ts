/** Standard GST slabs (India) for item master validation & dropdowns. */
export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * GST on line net: intra-state splits headline % into equal CGST+SGST on base;
 * inter-state applies full % as IGST on base.
 */
export function computeIndiaGstSplit(lineNet: number, headlineRatePercent: number, interState: boolean) {
  const net = round2(lineNet);
  const r = headlineRatePercent;
  if (!net || !r) {
    return { cgst: 0, sgst: 0, igst: 0, lineTax: 0 };
  }
  const lineTax = round2((net * r) / 100);
  if (interState) {
    return { cgst: 0, sgst: 0, igst: lineTax, lineTax };
  }
  const cgst = round2(lineTax / 2);
  const sgst = round2(lineTax - cgst);
  return { cgst, sgst, igst: 0, lineTax };
}

/** GST % to use on sales lines when an item is selected (exempt / non-taxable → 0). */
export function invoiceLineGstPercentFromItem(item: {
  gstTaxPreference: string;
  gstApplicable: boolean;
  gstRate: number;
}): number {
  if (item.gstTaxPreference !== "TAXABLE" || !item.gstApplicable) return 0;
  return item.gstRate;
}

/** GST % for purchase lines from item master. */
export function billLineGstPercentFromItem(item: {
  gstTaxPreference: string;
  gstApplicable: boolean;
  gstRate: number;
}): number {
  return invoiceLineGstPercentFromItem(item);
}

/** Optional category-name hint for default slab (UI only). */
export function suggestGstRateForCategoryName(categoryName: string): number | null {
  const n = categoryName.toLowerCase();
  if (/(food|grocery|milk|grain|rice)/.test(n)) return 5;
  if (/(hotel|restaurant|catering)/.test(n)) return 5;
  if (/(software|it service|consult|legal|account)/.test(n)) return 18;
  return null;
}

/** When tax is already computed (e.g. after line discount), split the rupee amount. */
export function splitTaxAmountIntoComponents(lineTax: number, interState: boolean) {
  const T = round2(lineTax);
  if (T <= 0) return { cgst: 0, sgst: 0, igst: 0, lineTax: 0 };
  if (interState) return { cgst: 0, sgst: 0, igst: T, lineTax: T };
  const cgst = round2(T / 2);
  const sgst = round2(T - cgst);
  return { cgst, sgst, igst: 0, lineTax: T };
}
