import { GstTaxPreference } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWarehouse } from "@/lib/inventory";
import { getSession } from "@/lib/session";

/** CSV columns: name, sku (optional), purchaseRate, salesRate, unit (optional), openingStock (optional) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await request.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must include header and at least one row." }, { status: 400 });
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iName = idx("name");
  const iSku = idx("sku");
  const iPurchase = idx("purchaserate") >= 0 ? idx("purchaserate") : idx("purchase_rate");
  const iSales = idx("salesrate") >= 0 ? idx("salesrate") : idx("sales_rate");
  const iUnit = idx("unit");
  const iOpen = idx("openingstock") >= 0 ? idx("openingstock") : idx("opening_stock");

  if (iName < 0 || iPurchase < 0 || iSales < 0) {
    return NextResponse.json(
      { error: "CSV header must include: name, purchaseRate, salesRate (comma-separated)." },
      { status: 400 },
    );
  }

  let created = 0;
  const errors: string[] = [];

  const wh = await ensureDefaultWarehouse(prisma, session.sub);

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(",").map((c) => c.trim());
    const name = cols[iName];
    if (!name) continue;

    const purchaseRate = Number.parseFloat(cols[iPurchase] ?? "0");
    const salesRate = Number.parseFloat(cols[iSales] ?? "0");
    if (Number.isNaN(purchaseRate) || Number.isNaN(salesRate)) {
      errors.push(`Row ${r + 1}: invalid numbers`);
      continue;
    }

    const sku = iSku >= 0 && cols[iSku] ? cols[iSku] : null;
    const unit = iUnit >= 0 && cols[iUnit] ? cols[iUnit] : "unit";
    const openingStock =
      iOpen >= 0 && cols[iOpen] !== undefined ? Number.parseFloat(cols[iOpen]) || 0 : 0;

    try {
      const item = await prisma.item.create({
        data: {
          userId: session.sub,
          itemType: "GOODS",
          name,
          sku,
          unit,
          salesRate,
          purchaseRate,
          sellable: true,
          purchasable: true,
          gstTaxPreference: GstTaxPreference.NON_TAXABLE,
          gstApplicable: false,
          gstRate: 0,
        },
      });

      if (openingStock > 0) {
        await prisma.itemStock.create({
          data: {
            itemId: item.id,
            warehouseId: wh.id,
            quantity: openingStock,
          },
        });
      }
      created += 1;
    } catch {
      errors.push(`Row ${r + 1}: could not import "${name}"`);
    }
  }

  return NextResponse.json({ created, errors });
}
