import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { buildEWayDraftFromInvoice } from "@/lib/eway/build-from-invoice";
import { createEWayFromInvoice } from "@/lib/eway/service";

/** GET /api/gst/eway-bills/from-invoice/[invoiceId] — preview draft */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ invoiceId: string }> },
) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { invoiceId } = await ctx.params;
  const draft = await buildEWayDraftFromInvoice(session.sub, invoiceId);
  if (!draft) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json(draft);
}

const postSchema = z.object({
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

/** POST /api/gst/eway-bills/from-invoice/[invoiceId] */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ invoiceId: string }> },
) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { invoiceId } = await ctx.params;
  let documentType = undefined;
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = postSchema.safeParse(json);
    if (parsed.success) documentType = parsed.data.documentType;
  } catch {
    /* optional body */
  }

  try {
    const { bill, automation } = await createEWayFromInvoice(session.sub, invoiceId, documentType);
    return NextResponse.json({ bill, automation }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create" }, { status: 400 });
  }
}
