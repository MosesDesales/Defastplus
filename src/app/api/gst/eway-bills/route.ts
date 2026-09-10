import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import {
  createEWayFromInvoice,
  listEWayBills,
  serializeEWayListRow,
} from "@/lib/eway/service";
import type { EWayBillStatus } from "@prisma/client";

const createSchema = z.object({
  invoiceId: z.string().min(1),
  documentType: z
    .enum([
      "TAX_INVOICE",
      "BILL_OF_SUPPLY",
      "DELIVERY_CHALLAN",
      "JOB_WORK_CHALLAN",
      "STOCK_TRANSFER",
      "PURCHASE_RETURN",
      "EXPORT_SHIPMENT",
    ])
    .optional(),
});

/** GET /api/gst/eway-bills — list with filters */
export async function GET(request: Request) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const rows = await listEWayBills(session.sub, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    gstin: searchParams.get("gstin") ?? undefined,
    invoiceNumber: searchParams.get("invoiceNumber") ?? undefined,
    vehicleNumber: searchParams.get("vehicleNumber") ?? undefined,
    status: (searchParams.get("status") as EWayBillStatus | null) ?? undefined,
  });

  return NextResponse.json({ items: rows.map(serializeEWayListRow) });
}

/** POST /api/gst/eway-bills — create from invoice */
export async function POST(request: Request) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { bill, automation } = await createEWayFromInvoice(
      session.sub,
      parsed.data.invoiceId,
      parsed.data.documentType,
    );
    return NextResponse.json({ bill, automation }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create E-Way Bill" }, { status: 400 });
  }
}
