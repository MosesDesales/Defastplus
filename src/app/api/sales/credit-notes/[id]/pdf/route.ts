import { NextResponse } from "next/server";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "credit_note");
  if (denied) return denied;
  const { id } = await ctx.params;

  const cn = await prisma.creditNote.findFirst({
    where: { id, userId: session.sub },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!cn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = cn.lines.map((l) => [
    l.description,
    Number(l.quantity),
    Number(l.rate),
    Number(l.lineTotal),
  ]);

  const buf = await buildLinesDocumentPdf({
    title: `Credit note ${cn.creditNumber}`,
    subtitle: cn.customer.displayName,
    meta: [
      ["Date", cn.issueDate.toISOString().slice(0, 10)],
      ["Status", cn.status],
      ["Total", Number(cn.total).toFixed(2)],
      ["Reason", cn.reason?.trim() || "—"],
    ],
    columns: ["Description", "Qty", "Rate", "Total"],
    rows,
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CreditNote-${cn.creditNumber}.pdf"`,
    },
  });
}
