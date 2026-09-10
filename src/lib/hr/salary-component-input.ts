import { Prisma } from "@prisma/client";

export type SalaryComponentInput = {
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amountType: "FLAT" | "PERCENT_OF_BASIC";
  amount?: number;
  percentOfBasic?: number | null;
  sortOrder?: number;
};

/** Validate + coerce raw component rows from a request body into Prisma create input. */
export function normalizeComponents(
  raw: unknown,
): { ok: true; data: Prisma.SalaryComponentCreateWithoutStructureInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "At least one component is required" };

  const data: Prisma.SalaryComponentCreateWithoutStructureInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] as SalaryComponentInput;
    const name = c?.name?.trim();
    if (!name) return { ok: false, error: `Component ${i + 1}: name required` };
    if (c.kind !== "EARNING" && c.kind !== "DEDUCTION") return { ok: false, error: `Component ${i + 1}: invalid kind` };
    if (c.amountType !== "FLAT" && c.amountType !== "PERCENT_OF_BASIC") {
      return { ok: false, error: `Component ${i + 1}: invalid amountType` };
    }
    data.push({
      name,
      kind: c.kind,
      amountType: c.amountType,
      amount: new Prisma.Decimal(c.amount ?? 0),
      percentOfBasic: c.percentOfBasic != null ? new Prisma.Decimal(c.percentOfBasic) : null,
      sortOrder: c.sortOrder ?? i,
    });
  }
  return { ok: true, data };
}
