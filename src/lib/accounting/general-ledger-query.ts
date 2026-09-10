import { JournalPostingStatus, type AccountType } from "@prisma/client";
import { openingDebitCredit, runningBalanceAfter } from "@/lib/accounting/gl";
import type { PrismaClient } from "@prisma/client";

export type GeneralLedgerRow = {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type GeneralLedgerAccountSummary = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export async function buildGeneralLedgerSection(
  prisma: PrismaClient,
  userId: string,
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    openingBalance: { toString(): string } | number;
  },
  from: Date,
  to: Date,
): Promise<{
  account: GeneralLedgerAccountSummary;
  rows: GeneralLedgerRow[];
  closingBalance: number;
}> {
  const priorLines = await prisma.journalLine.findMany({
    where: {
      accountId: account.id,
      journalEntry: {
        userId,
        postingStatus: JournalPostingStatus.POSTED,
        entryDate: { lt: from },
      },
    },
  });

  let priorDebit = 0;
  let priorCredit = 0;
  for (const l of priorLines) {
    priorDebit += Number(l.debit);
    priorCredit += Number(l.credit);
  }

  const ob = openingDebitCredit(account.type, Number(account.openingBalance));
  let netOpening = ob.debit - ob.credit + (priorDebit - priorCredit);

  const rows: GeneralLedgerRow[] = [];

  rows.push({
    date: from.toISOString(),
    reference: "—",
    description: "Beginning balance",
    debit: netOpening > 0 ? netOpening : 0,
    credit: netOpening < 0 ? -netOpening : 0,
    balance: netOpening,
  });

  let running = netOpening;

  const linesInPeriod = await prisma.journalLine.findMany({
    where: {
      accountId: account.id,
      journalEntry: {
        userId,
        postingStatus: JournalPostingStatus.POSTED,
        entryDate: { gte: from, lte: to },
      },
    },
    include: {
      journalEntry: {
        select: {
          entryDate: true,
          referenceNo: true,
          memo: true,
          referenceKind: true,
        },
      },
    },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
  });

  for (const line of linesInPeriod) {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    running = runningBalanceAfter(running, debit, credit);
    const ref =
      line.journalEntry.referenceNo ??
      line.journalEntry.memo?.slice(0, 48) ??
      String(line.journalEntry.referenceKind ?? "—");
    const desc =
      line.description?.trim() ||
      line.journalEntry.memo?.trim() ||
      String(line.journalEntry.referenceKind ?? "");

    rows.push({
      date: line.journalEntry.entryDate.toISOString(),
      reference: ref,
      description: desc || "—",
      debit,
      credit,
      balance: running,
    });
  }

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    },
    rows,
    closingBalance: running,
  };
}
