import { CreditNoteStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { postCreditNoteJournal } from "@/lib/accounting/posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

/** Issue a draft credit note (OPEN + GL). */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "credit_note");
  if (denied) return denied;
  const { id } = await ctx.params;

  let action: string | undefined;
  try {
    const j = await request.json();
    action = typeof j === "object" && j && "action" in j ? String((j as { action?: unknown }).action) : undefined;
  } catch {
    /* empty */
  }

  if (action !== "issue") {
    return NextResponse.json({ error: 'Expected JSON body { "action": "issue" }' }, { status: 400 });
  }

  const cn = await prisma.creditNote.findFirst({
    where: { id, userId: session.sub },
  });
  if (!cn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cn.status !== CreditNoteStatus.DRAFT) {
    return NextResponse.json({ error: "Only draft credit notes can be issued." }, { status: 400 });
  }
  if (cn.reversalJournalId) {
    return NextResponse.json({ error: "Already posted." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditNote.update({
      where: { id: cn.id },
      data: { status: CreditNoteStatus.OPEN },
    });
    await postCreditNoteJournal(tx, session.sub, cn.id);
  });

  return NextResponse.json({ ok: true });
}
