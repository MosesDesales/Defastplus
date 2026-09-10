import type { SalaryAmountType, SalaryComponentKind } from "@prisma/client";

export type ComponentInput = {
  id: string;
  name: string;
  kind: SalaryComponentKind;
  amountType: SalaryAmountType;
  amount: number;
  percentOfBasic: number | null;
  sortOrder: number;
};

export type PayslipLine = { name: string; kind: "EARNING" | "DEDUCTION"; amount: number };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Resolve salary from ordered components; Basic is detected by name or first flat earning. */
export function computeSalaryBreakdown(components: ComponentInput[]): {
  lines: PayslipLine[];
  gross: number;
  totalDeductions: number;
  netPay: number;
} {
  const sorted = [...components].sort((a, b) => a.sortOrder - b.sortOrder);

  let basic = 0;
  const earningLines: PayslipLine[] = [];

  for (const c of sorted) {
    if (c.kind !== "EARNING" || c.amountType !== "FLAT") continue;
    const amt = round2(Number(c.amount));
    earningLines.push({ name: c.name, kind: "EARNING", amount: amt });
    if (/basic/i.test(c.name)) basic = amt;
  }
  if (basic === 0 && earningLines.length > 0) {
    basic = earningLines[0]!.amount;
  }

  for (const c of sorted) {
    if (c.kind !== "EARNING" || c.amountType !== "PERCENT_OF_BASIC") continue;
    const pct = Number(c.percentOfBasic ?? 0);
    const amt = round2((basic * pct) / 100);
    earningLines.push({ name: c.name, kind: "EARNING", amount: amt });
  }

  const gross = round2(earningLines.reduce((s, l) => s + l.amount, 0));

  const deductionLines: PayslipLine[] = [];
  for (const c of sorted) {
    if (c.kind !== "DEDUCTION") continue;
    let amt = 0;
    if (c.amountType === "FLAT") amt = round2(Number(c.amount));
    else if (c.amountType === "PERCENT_OF_BASIC") amt = round2((basic * Number(c.percentOfBasic ?? 0)) / 100);
    deductionLines.push({ name: c.name, kind: "DEDUCTION", amount: amt });
  }

  const totalDeductions = round2(deductionLines.reduce((s, l) => s + l.amount, 0));
  const netPay = round2(gross - totalDeductions);

  return { lines: [...earningLines, ...deductionLines], gross, totalDeductions, netPay };
}
