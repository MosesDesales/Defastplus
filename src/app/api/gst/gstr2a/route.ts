import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { isInterState, resolvedLineGstComponents } from "@/lib/gst/split";

/** GET /api/gst/gstr2a — purchase lines derived from vendor bills (GSTR-2A style). */
export async function GET(request: Request) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month")?.trim() ?? "";
  const vendorId = searchParams.get("vendorId")?.trim() ?? "";
  const statusFilter = searchParams.get("status")?.trim() ?? "";

  const profile = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  const companyGstin = profile?.gstin ?? null;

  const now = new Date();
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
  const start = new Date(yy!, mm! - 1, 1, 0, 0, 0, 0);
  const end = new Date(yy!, mm!, 0, 23, 59, 59, 999);

  const bills = await prisma.vendorBill.findMany({
    where: {
      userId: session.sub,
      status: { not: "DRAFT" },
      billDate: { gte: start, lte: end },
      ...(vendorId ? { vendorId } : {}),
    },
    include: {
      vendor: { select: { id: true, displayName: true, gstin: true } },
      lines: true,
      gstReconciliation: true,
    },
    orderBy: { billDate: "asc" },
  });

  const rows = bills.map((b) => {
    const taxable = b.lines.reduce((s, l) => s + Number(l.lineNet), 0);
    const tax = b.lines.reduce((s, l) => s + Number(l.lineTax), 0);
    const inter = isInterState(companyGstin, b.vendor.gstin);
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const l of b.lines) {
      const p = resolvedLineGstComponents(
        {
          lineTax: Number(l.lineTax),
          lineCgst: Number(l.lineCgst),
          lineSgst: Number(l.lineSgst),
          lineIgst: Number(l.lineIgst),
        },
        inter,
      );
      cgst += p.cgst;
      sgst += p.sgst;
      igst += p.igst;
    }
    const recon = b.gstReconciliation;
    const status = recon?.status ?? "PENDING";
    return {
      billId: b.id,
      vendorId: b.vendorId,
      vendorName: b.vendor.displayName,
      vendorGstin: b.vendor.gstin,
      invoiceNumber: b.billNumber,
      invoiceDate: b.billDate.toISOString().slice(0, 10),
      taxableValue: Math.round(taxable * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      status,
      portalInvoiceNo: recon?.portalInvoiceNo ?? null,
    };
  });

  const filtered =
    statusFilter && statusFilter !== "ALL" ? rows.filter((r) => r.status === statusFilter || (statusFilter === "UNRECONCILED" && r.status === "PENDING")) : rows;

  const mismatchAlerts: string[] = [];
  for (const b of bills) {
    if (!b.vendor.gstin && Number(b.taxTotal) > 0) {
      mismatchAlerts.push(`Bill ${b.billNumber}: vendor GSTIN missing — reconciliation risk.`);
    }
  }

  return NextResponse.json({ month: ym, rows: filtered, mismatchAlerts });
}
