import { NextResponse } from "next/server";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const b = await prisma.vendorBill.findFirst({
    where: { id, userId: session.sub },
    include: { vendor: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = b.lines.map((l) => [
    l.description,
    Number(l.quantity),
    Number(l.rate),
    Number(l.lineTotal),
  ]);
  const buf = await buildLinesDocumentPdf({
    title: `Vendor bill ${b.billNumber}`,
    subtitle: b.vendor.displayName,
    meta: [
      ["Date", b.billDate.toISOString().slice(0, 10)],
      ["Status", b.status],
      ["Total", Number(b.total).toFixed(2)],
    ],
    columns: ["Description", "Qty", "Rate", "Line total"],
    rows,
    footerLines: [`Tax total: ${Number(b.taxTotal).toFixed(2)}`, `Subtotal: ${Number(b.subTotal).toFixed(2)}`],
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Bill-${b.billNumber}.pdf"`,
    },
  });
}
