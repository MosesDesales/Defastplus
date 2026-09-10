import { JournalPostingStatus, JournalReferenceKind, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";

type Db = PrismaClient | Prisma.TransactionClient;

function z() {
  return new Prisma.Decimal(0);
}

/** Ensure payroll liability account exists (2122). */
async function ensureSalaryPayableAccount(db: Db, userId: string): Promise<string> {
  await ensureDefaultAccounts(db, userId);
  const code = "2122";
  const row = await db.account.findUnique({
    where: { userId_code: { userId, code } },
  });
  if (row) return row.id;
  const created = await db.account.create({
    data: {
      userId,
      code,
      name: "Salary Payable",
      type: "LIABILITY",
      isSystem: false,
    },
  });
  return created.id;
}

async function salaryExpenseAccountId(db: Db, userId: string): Promise<string> {
  await ensureDefaultAccounts(db, userId);
  const row = await db.account.findFirst({
    where: { userId, code: "5120" },
  });
  if (row) return row.id;
  const fallback = await db.account.findFirst({
    where: { userId, type: "EXPENSE" },
    orderBy: { code: "asc" },
  });
  if (!fallback) throw new Error("No expense account for payroll.");
  return fallback.id;
}

/** Dr Salary expense (net payroll), Cr Salary Payable — matches payslip net totals. */
export async function postPayrollAccrualJournal(db: Db, userId: string, payrollRunId: string) {
  const run = await db.payrollRun.findFirst({
    where: { id: payrollRunId, userId },
    include: { payslips: true },
  });
  if (!run || run.journalEntryId) return;

  const netTotal = run.payslips.reduce((s, p) => s.add(p.netPay), z());
  if (netTotal.eq(z())) return;

  const expenseId = await salaryExpenseAccountId(db, userId);
  const payableId = await ensureSalaryPayableAccount(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: new Date(),
      memo: `Payroll ${run.yearMonth}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.PAYROLL_RUN,
      referenceId: run.id,
      referenceNo: `PR-${run.yearMonth}`,
      lines: {
        create: [
          { accountId: expenseId, debit: netTotal, credit: z() },
          { accountId: payableId, debit: z(), credit: netTotal },
        ],
      },
    },
  });

  await db.payrollRun.update({
    where: { id: run.id },
    data: { journalEntryId: je.id },
  });
}
