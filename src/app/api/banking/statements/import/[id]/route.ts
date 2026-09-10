import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const imp = await prisma.bankStatementImport.findFirst({
    where: { id, userId: session.sub },
  });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deleted = await prisma.$transaction(async (tx) => {
    const n = await tx.bankingTransaction.deleteMany({
      where: { statementImportId: id, userId: session.sub },
    });
    await tx.bankStatementImport.delete({ where: { id } });
    return n.count;
  });

  return NextResponse.json({ ok: true, deletedTransactions: deleted });
}
