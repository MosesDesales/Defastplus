import { NextResponse } from "next/server";
import { buildLinesDocumentPdf } from "@/lib/pdf/generic-lines-pdf";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const e = await prisma.purchaseExpense.findFirst({
    where: { id, userId: session.sub },
    include: { expenseAccount: true, bankAccount: true },
  });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildLinesDocumentPdf({
    title: "Purchase expense",
    subtitle: e.expenseDate.toISOString().slice(0, 10),
    meta: [],
    columns: ["Field", "Value"],
    rows: [
      ["Expense account", `${e.expenseAccount.code} — ${e.expenseAccount.name}`],
      ["Bank", `${e.bankAccount.code} — ${e.bankAccount.name}`],
      ["Amount", Number(e.amount)],
      ["Tax", Number(e.taxAmount)],
      ["Posted", e.journalEntryId ? "Yes" : "No"],
      ["Notes", e.notes?.trim() || "—"],
    ],
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Expense-${e.expenseDate.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
