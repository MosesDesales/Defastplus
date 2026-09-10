import { GstTaxPreference, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { computeIndiaGstSplit } from "@/lib/gst/line-india-tax";
import { resolveInterStateForLine } from "@/lib/gst/item-gst";
import { isInterState } from "@/lib/gst/split";

export type BuiltInvoiceLineRow = {
  itemId: string | null;
  description: string;
  quantity: Prisma.Decimal;
  rate: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  lineNet: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  lineCgst: Prisma.Decimal;
  lineSgst: Prisma.Decimal;
  lineIgst: Prisma.Decimal;
  sortOrder: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type LineInput = {
  itemId?: string | null;
  description: string;
  quantity: number;
  rate: number;
  taxPercent?: number;
};

export async function buildInvoiceLineRows(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  customer: { gstin: string | null },
  companyGstin: string | null,
  lines: LineInput[],
): Promise<{ ok: true; lineRows: BuiltInvoiceLineRow[]; subTotal: number; taxTotal: number; total: number } | { ok: false; error: string }> {
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter(Boolean))] as string[];
  const catalogItems =
    itemIds.length > 0 ? await db.item.findMany({ where: { userId, id: { in: itemIds } } }) : [];
  const itemsById = new Map(catalogItems.map((it) => [it.id, it]));

  let subTotal = 0;
  let taxTotal = 0;
  const lineRows: BuiltInvoiceLineRow[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx]!;
    const qty = l.quantity;
    const rate = l.rate;
    const lineNet = round2(qty * rate);
    const item = l.itemId ? itemsById.get(l.itemId) : undefined;
    if (l.itemId && !item) {
      return { ok: false, error: `Unknown item on line ${idx + 1}` };
    }
    let taxPercent = l.taxPercent ?? 0;
    if (item) {
      if (item.gstTaxPreference !== GstTaxPreference.TAXABLE || !item.gstApplicable) {
        taxPercent = 0;
      } else if (!item.hsnCode?.trim()) {
        return { ok: false, error: `Item "${item.name}" is taxable but missing HSN/SAC in the catalog.` };
      }
    }
    const inter = item
      ? resolveInterStateForLine(item.gstTaxMode, companyGstin, customer.gstin)
      : isInterState(companyGstin, customer.gstin);
    const split =
      taxPercent > 0 ? computeIndiaGstSplit(lineNet, taxPercent, inter) : { cgst: 0, sgst: 0, igst: 0, lineTax: 0 };
    const lineTotal = round2(lineNet + split.lineTax);
    subTotal = round2(subTotal + lineNet);
    taxTotal = round2(taxTotal + split.lineTax);
    lineRows.push({
      itemId: l.itemId ?? null,
      description: l.description.trim(),
      quantity: new Prisma.Decimal(qty),
      rate: new Prisma.Decimal(rate),
      taxPercent: new Prisma.Decimal(taxPercent),
      lineNet: new Prisma.Decimal(lineNet),
      lineTax: new Prisma.Decimal(split.lineTax),
      lineTotal: new Prisma.Decimal(lineTotal),
      lineCgst: new Prisma.Decimal(split.cgst),
      lineSgst: new Prisma.Decimal(split.sgst),
      lineIgst: new Prisma.Decimal(split.igst),
      sortOrder: idx,
    });
  }

  const total = round2(subTotal + taxTotal);
  return { ok: true, lineRows, subTotal, taxTotal, total };
}
