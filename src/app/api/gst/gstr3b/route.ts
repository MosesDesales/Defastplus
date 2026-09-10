import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { isInterState, resolvedLineGstComponents } from "@/lib/gst/split";

/** GET /api/gst/gstr3b — monthly GSTR-3B-style summary from sales & purchases. */
export async function GET(request: Request) {
  const session = await requireApiPermission("gst.view");
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month")?.trim() ?? "";
  const format = searchParams.get("format")?.trim() ?? "json";

  const profile = await prisma.companyProfile.findUnique({ where: { userId: session.sub } });
  const companyGstin = profile?.gstin ?? null;

  const now = new Date();
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
  const start = new Date(yy!, mm! - 1, 1, 0, 0, 0, 0);
  const end = new Date(yy!, mm!, 0, 23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({
    where: { userId: session.sub, issueDate: { gte: start, lte: end }, status: { not: "VOID" } },
    include: { customer: true, lines: true },
  });

  let outTaxable = 0;
  let outCgst = 0;
  let outSgst = 0;
  let outIgst = 0;

  for (const inv of invoices) {
    const inter = isInterState(companyGstin, inv.customer.gstin);
    for (const line of inv.lines) {
      const net = Number(line.lineNet);
      outTaxable += net;
      const sp = resolvedLineGstComponents(
        {
          lineTax: Number(line.lineTax),
          lineCgst: Number(line.lineCgst),
          lineSgst: Number(line.lineSgst),
          lineIgst: Number(line.lineIgst),
        },
        inter,
      );
      outCgst += sp.cgst;
      outSgst += sp.sgst;
      outIgst += sp.igst;
    }
  }

  const bills = await prisma.vendorBill.findMany({
    where: { userId: session.sub, billDate: { gte: start, lte: end }, status: { not: "DRAFT" } },
    include: { vendor: true, lines: true },
  });

  let inTaxable = 0;
  let inCgst = 0;
  let inSgst = 0;
  let inIgst = 0;

  for (const b of bills) {
    const inter = isInterState(companyGstin, b.vendor.gstin);
    for (const line of b.lines) {
      const net = Number(line.lineNet);
      inTaxable += net;
      const sp = resolvedLineGstComponents(
        {
          lineTax: Number(line.lineTax),
          lineCgst: Number(line.lineCgst),
          lineSgst: Number(line.lineSgst),
          lineIgst: Number(line.lineIgst),
        },
        inter,
      );
      inCgst += sp.cgst;
      inSgst += sp.sgst;
      inIgst += sp.igst;
    }
  }

  const reverseCharge = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const itc = { cgst: inCgst, sgst: inSgst, igst: inIgst };
  const outward = { taxable: outTaxable, cgst: outCgst, sgst: outSgst, igst: outIgst };
  const inward = { taxable: inTaxable, cgst: inCgst, sgst: inSgst, igst: inIgst };

  const taxPayable = {
    cgst: outCgst - itc.cgst,
    sgst: outSgst - itc.sgst,
    igst: outIgst - itc.igst,
  };

  const round = (n: number) => Math.round(n * 100) / 100;
  const payload = {
    month: ym,
    outwardSupplies: {
      taxableValue: round(outward.taxable),
      cgst: round(outward.cgst),
      sgst: round(outward.sgst),
      igst: round(outward.igst),
    },
    inwardSupplies: {
      taxableValue: round(inward.taxable),
      cgst: round(inward.cgst),
      sgst: round(inward.sgst),
      igst: round(inward.igst),
    },
    reverseCharge,
    itc: {
      cgst: round(itc.cgst),
      sgst: round(itc.sgst),
      igst: round(itc.igst),
    },
    taxPayable: {
      cgst: round(taxPayable.cgst),
      sgst: round(taxPayable.sgst),
      igst: round(taxPayable.igst),
    },
  };

  if (format === "excel") {
    const csv = [
      "Section,Taxable,CGST,SGST,IGST",
      `Outward,${payload.outwardSupplies.taxableValue},${payload.outwardSupplies.cgst},${payload.outwardSupplies.sgst},${payload.outwardSupplies.igst}`,
      `Inward (ITC),${payload.inwardSupplies.taxableValue},${payload.inwardSupplies.cgst},${payload.inwardSupplies.sgst},${payload.inwardSupplies.igst}`,
      `Tax Payable,—,${payload.taxPayable.cgst},${payload.taxPayable.sgst},${payload.taxPayable.igst}`,
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="GSTR3B-${ym}.csv"`,
      },
    });
  }

  return NextResponse.json(payload);
}
