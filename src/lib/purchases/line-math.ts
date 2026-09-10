import { Prisma } from "@prisma/client";

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Exclusive tax: net = qty*rate, tax = net * p/100, total = net+tax */
export function computeLineAmounts(quantity: number, rate: number, taxPercent: number) {
  const lineNet = round2(quantity * rate);
  const lineTax = round2((lineNet * taxPercent) / 100);
  const lineTotal = round2(lineNet + lineTax);
  return {
    lineNet: new Prisma.Decimal(lineNet),
    lineTax: new Prisma.Decimal(lineTax),
    lineTotal: new Prisma.Decimal(lineTotal),
  };
}

/** Line discount applied on gross (qty×rate), then tax on discounted net. */
export function computeBillLineAmounts(quantity: number, rate: number, discountPercent: number, taxPercent: number) {
  const gross = round2(quantity * rate);
  const discAmt = round2(gross * (discountPercent / 100));
  const lineNet = round2(gross - discAmt);
  const lineTax = round2((lineNet * taxPercent) / 100);
  const lineTotal = round2(lineNet + lineTax);
  return {
    lineNet: new Prisma.Decimal(lineNet),
    lineTax: new Prisma.Decimal(lineTax),
    lineTotal: new Prisma.Decimal(lineTotal),
  };
}
