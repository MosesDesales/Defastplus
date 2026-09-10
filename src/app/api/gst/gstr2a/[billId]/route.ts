import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { yearMonthFromDate } from "@/lib/gst/split";

type RouteParams = { params: Promise<{ billId: string }> };

/** PATCH — Match or reconcile a bill row for GSTR-2A. Body: { action: "MATCH" | "RECONCILE", month?, portalInvoiceNo? } */
export async function PATCH(request: Request, props: RouteParams) {
  const session = await requireApiPermission("gst.edit");
  if (session instanceof NextResponse) return session;

  const { billId } = await props.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { action?: string; month?: string; portalInvoiceNo?: string };
  const action = body.action?.toUpperCase() ?? "";

  const bill = await prisma.vendorBill.findFirst({
    where: { id: billId, userId: session.sub },
  });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const monthKey = body.month?.trim() || yearMonthFromDate(bill.billDate);

  const status = action === "RECONCILE" ? "RECONCILED" : "MATCHED";

  await prisma.gstBillReconciliation.upsert({
    where: { billId },
    create: {
      userId: session.sub,
      billId,
      monthKey,
      status,
      portalInvoiceNo: body.portalInvoiceNo?.trim() ?? null,
    },
    update: {
      monthKey,
      status,
      portalInvoiceNo: body.portalInvoiceNo?.trim() ?? undefined,
    },
  });

  await writeAuditLog(session.sub, action === "RECONCILE" ? "GST_RECONCILE" : "GST_MATCH", "VendorBill", billId, { monthKey });

  return NextResponse.json({ ok: true });
}
