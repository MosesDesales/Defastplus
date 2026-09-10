import { JournalPostingStatus, JournalReferenceKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { validateManualJournalLines } from "@/lib/accounting/journal-validate";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { manualJournalUpsertSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;

  await ensureDefaultAccounts(prisma, session.sub);

  const rows = await prisma.journalEntry.findMany({
    where: {
      userId: session.sub,
      referenceKind: JournalReferenceKind.MANUAL,
    },
    orderBy: { entryDate: "desc" },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } } },
    },
    take: 200,
  });

  return NextResponse.json({
    journals: rows.map((j) => ({
      id: j.id,
      entryDate: j.entryDate.toISOString(),
      referenceNo: j.referenceNo,
      memo: j.memo,
      postingStatus: j.postingStatus,
      totalDebit: j.lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: j.lines.reduce((s, l) => s + Number(l.credit), 0),
      lineCount: j.lines.length,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "manual_journal");
  if (denied) return denied;

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
  const err = validateManualJournalLines(data.lines);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({
    where: { userId: session.sub, id: { in: accountIds }, isActive: true },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    return NextResponse.json({ error: "One or more accounts are invalid or inactive." }, { status: 400 });
  }

  const entryDate = new Date(data.entryDate);
  if (Number.isNaN(entryDate.getTime())) {
    return NextResponse.json({ error: "Invalid entry date." }, { status: 400 });
  }

  let referenceNo = data.referenceNo?.trim() || null;
  if (!referenceNo) {
    const n = await prisma.journalEntry.count({
      where: { userId: session.sub, referenceKind: JournalReferenceKind.MANUAL },
    });
    referenceNo = `MJ-${String(n + 1).padStart(5, "0")}`;
  }

  const postingStatus =
    data.action === "post" ? JournalPostingStatus.POSTED : JournalPostingStatus.DRAFT;

  const je = await prisma.journalEntry.create({
    data: {
      userId: session.sub,
      entryDate,
      memo: data.notes?.trim() ?? null,
      referenceKind: JournalReferenceKind.MANUAL,
      referenceId: null,
      referenceNo,
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

  return NextResponse.json(
    { journal: { id: je.id, referenceNo, postingStatus } },
    { status: 201 },
  );
}
