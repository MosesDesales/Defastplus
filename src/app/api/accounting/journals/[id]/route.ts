import { JournalPostingStatus, JournalReferenceKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { validateManualJournalLines } from "@/lib/accounting/journal-validate";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { manualJournalUpsertSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;
  const { id } = await ctx.params;

  const j = await prisma.journalEntry.findFirst({
    where: {
      id,
      userId: session.sub,
      referenceKind: JournalReferenceKind.MANUAL,
    },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true, type: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!j) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    journal: {
      id: j.id,
      entryDate: j.entryDate.toISOString(),
      referenceNo: j.referenceNo,
      notes: j.memo,
      postingStatus: j.postingStatus,
      lines: j.lines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.account.code,
        accountName: l.account.name,
        description: l.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, userId: session.sub, referenceKind: JournalReferenceKind.MANUAL },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.postingStatus !== JournalPostingStatus.DRAFT) {
    return NextResponse.json({ error: "Only draft journals can be edited." }, { status: 409 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = manualJournalUpsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const lineErr = validateManualJournalLines(data.lines);
  if (lineErr) return NextResponse.json({ error: lineErr }, { status: 400 });

  const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
  const acctOk = await prisma.account.count({
    where: { userId: session.sub, id: { in: accountIds }, isActive: true },
  });
  if (acctOk !== accountIds.length) {
    return NextResponse.json({ error: "Invalid account on a line." }, { status: 400 });
  }

  const entryDate = new Date(data.entryDate);
  if (Number.isNaN(entryDate.getTime())) {
    return NextResponse.json({ error: "Invalid entry date." }, { status: 400 });
  }

  const postingStatus =
    data.action === "post" ? JournalPostingStatus.POSTED : JournalPostingStatus.DRAFT;

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
    await tx.journalEntry.update({
      where: { id },
      data: {
        entryDate,
        memo: data.notes?.trim() ?? null,
        referenceNo: data.referenceNo?.trim() ?? existing.referenceNo,
        postingStatus,
        lines: {
          create: data.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description?.trim() ?? null,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
    });
  });

  return NextResponse.json({ ok: true, postingStatus });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, userId: session.sub, referenceKind: JournalReferenceKind.MANUAL },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.postingStatus !== JournalPostingStatus.DRAFT) {
    return NextResponse.json({ error: "Only drafts can be deleted." }, { status: 409 });
  }

  await prisma.journalEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
