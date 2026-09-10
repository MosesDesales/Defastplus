import type { Invoice } from "@prisma/client";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type InvoiceSummaryInput = {
  discountPercent: number;
  withholdingType: "NONE" | "TDS" | "TCS";
  withholdingPercent: number;
  adjustmentAmount: number;
};

export type InvoiceSummaryView = InvoiceSummaryInput & {
  adjustmentLabel: string;
  lineNetSum: number;
  lineTaxSum: number;
  lineGrand: number;
  discountAmount: number;
  netAfterDiscount: number;
  taxAfterDiscount: number;
  preWithholding: number;
  withholdingAmount: number;
  afterWithholding: number;
  payableTotal: number;
};

/** Same rules as InvoiceCreateForm summaryCalc. */
export function computeInvoiceSummaryView(
  lineNetSum: number,
  lineTaxSum: number,
  label: string,
  input: InvoiceSummaryInput,
): InvoiceSummaryView {
  const lineGrand = round2(lineNetSum + lineTaxSum);
  const dPct = Math.min(100, Math.max(0, input.discountPercent));
  const discountAmount = round2(lineNetSum * (dPct / 100));
  const netAfterDiscount = round2(lineNetSum - discountAmount);
  const factor = lineNetSum > 0 ? netAfterDiscount / lineNetSum : 0;
  const taxAfterDiscount = round2(lineTaxSum * factor);
  const preWithholding = round2(netAfterDiscount + taxAfterDiscount);
  const whRate = Math.min(100, Math.max(0, input.withholdingPercent));
  const withholdingAmount =
    input.withholdingType === "NONE" || whRate === 0 ? 0 : round2((preWithholding * whRate) / 100);
  const afterWithholding =
    input.withholdingType === "TDS"
      ? round2(preWithholding - withholdingAmount)
      : input.withholdingType === "TCS"
        ? round2(preWithholding + withholdingAmount)
        : preWithholding;
  const adjustmentAmount = round2(Number.isFinite(input.adjustmentAmount) ? input.adjustmentAmount : 0);
  const payableTotal = round2(afterWithholding + adjustmentAmount);

  return {
    adjustmentLabel: label.trim() || "Adjustment",
    discountPercent: dPct,
    withholdingType: input.withholdingType,
    withholdingPercent: whRate,
    adjustmentAmount,
    lineNetSum: round2(lineNetSum),
    lineTaxSum: round2(lineTaxSum),
    lineGrand,
    discountAmount,
    netAfterDiscount,
    taxAfterDiscount,
    preWithholding,
    withholdingAmount,
    afterWithholding,
    payableTotal,
  };
}

export type InvoiceSummaryFields = Pick<
  Invoice,
  | "discountPercent"
  | "withholdingType"
  | "withholdingPercent"
  | "adjustmentLabel"
  | "adjustmentAmount"
  | "subTotal"
  | "taxTotal"
  | "total"
  | "payableTotal"
>;

export function summaryInputFromInvoice(inv: InvoiceSummaryFields): InvoiceSummaryInput {
  const wt = inv.withholdingType;
  const withholdingType = wt === "TDS" || wt === "TCS" ? wt : "NONE";
  return {
    discountPercent: Number(inv.discountPercent),
    withholdingType,
    withholdingPercent: Number(inv.withholdingPercent),
    adjustmentAmount: Number(inv.adjustmentAmount),
  };
}

export function invoiceSummaryViewFromStored(inv: InvoiceSummaryFields): InvoiceSummaryView {
  return computeInvoiceSummaryView(
    Number(inv.subTotal),
    Number(inv.taxTotal),
    inv.adjustmentLabel ?? "Adjustment",
    summaryInputFromInvoice(inv),
  );
}

/** Open amount for allocations (amount due on the invoice). */
export function invoiceOpenAmount(inv: Pick<Invoice, "payableTotal" | "total">): number {
  const p = Number(inv.payableTotal);
  if (Number.isFinite(p)) return round2(p);
  return round2(Number(inv.total));
}
