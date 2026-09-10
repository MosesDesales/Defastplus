import { NextResponse } from "next/server";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const q = await prisma.quote.findFirst({
    where: { id, userId: session.sub },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = q.lines.map((l) => [
    l.description,
    Number(l.quantity),
    Number(l.rate),
    Number(l.amount),
  ]);
  const buf = await buildLinesDocumentPdf({
    title: `Quote ${q.quoteNumber}`,
    subtitle: q.customer.displayName,
    meta: [
      ["Date", q.quoteDate.toISOString().slice(0, 10)],
      ["Status", q.status],
      ["Total", Number(q.total).toFixed(2)],
    ],
    columns: ["Description", "Qty", "Rate", "Amount"],
    rows,
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quote-${q.quoteNumber}.pdf"`,
    },
  });
}
