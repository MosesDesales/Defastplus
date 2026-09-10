import { JournalPostingStatus, JournalReferenceKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { validateManualJournalLines } from "@/lib/accounting/journal-validate";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

/** Post a draft manual journal after re-validating balance. */
export async function POST(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, userId: session.sub, referenceKind: JournalReferenceKind.MANUAL },
    include: { lines: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.postingStatus !== JournalPostingStatus.DRAFT) {
    return NextResponse.json({ error: "Journal is already posted." }, { status: 409 });
  }

  const lines = existing.lines.map((l) => ({
    debit: Number(l.debit),
    credit: Number(l.credit),
  }));
  const err = validateManualJournalLines(lines);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  await prisma.journalEntry.update({
    where: { id },
    data: { postingStatus: JournalPostingStatus.POSTED },
  });

  return NextResponse.json({ ok: true });
}
