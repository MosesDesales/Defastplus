import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { getEWayBill } from "@/lib/eway/service";
import { buildEWayBillPdf } from "@/lib/pdf/eway-bill-pdf";

/** GET /api/gst/eway-bills/[id]/pdf */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const bill = await getEWayBill(session.sub, id);
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await buildEWayBillPdf(bill);
  const filename = bill.ewayBillNumber
    ? `eway-${bill.ewayBillNumber}.pdf`
    : `eway-draft-${bill.sourceDocumentNumber.replace(/[^\w-]/g, "_")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
