import {
  JournalPostingStatus,
  JournalReferenceKind,
  Prisma,
  VendorBillStatus,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ensureDefaultAccounts, getPurchasesAccountIds } from "@/lib/accounting/default-accounts";

type Db = PrismaClient | Prisma.TransactionClient;

function z() {
  return new Prisma.Decimal(0);
}

/** Dr Expense (net), Dr GST Input (tax), Cr Bank (total). */
export async function postPurchaseExpenseJournal(db: Db, userId: string, expenseId: string) {
  const ex = await db.purchaseExpense.findFirst({
    where: { id: expenseId, userId },
  });
  if (!ex || ex.journalEntryId) return;

  await ensureDefaultAccounts(db, userId);

  const { gstInputId } = await getPurchasesAccountIds(db, userId);
  if (!gstInputId) {
    throw new Error("GST/VAT Input account (1410) is missing. Run chart-of-accounts setup or restore default accounts.");
  }
  const net = new Prisma.Decimal(ex.amount);
  const tax = new Prisma.Decimal(ex.taxAmount);
  const total = net.add(tax);

  const lines: { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[] = [
    { accountId: ex.expenseAccountId, debit: net, credit: z() },
  ];
  if (tax.gt(z())) {
    lines.push({ accountId: gstInputId, debit: tax, credit: z() });
  }
  lines.push({ accountId: ex.bankAccountId, debit: z(), credit: total });

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: ex.expenseDate,
      memo: ex.notes?.slice(0, 200) ?? "Purchase expense",
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.PURCHASE_EXPENSE,
      referenceId: ex.id,
      referenceNo: `EXP-${ex.id.slice(-8)}`,
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });

  await db.purchaseExpense.update({
    where: { id: ex.id },
    data: { journalEntryId: je.id },
  });
}

/** Bill posting: Dr expense lines + GST input, Cr AP. Only UNPAID+ (not DRAFT/VOID). */
export async function postVendorBillJournal(db: Db, userId: string, billId: string) {
  const bill = await db.vendorBill.findFirst({
    where: { id: billId, userId },
    include: { lines: true },
  });
  if (!bill || bill.journalEntryId) return;
  if (bill.status === VendorBillStatus.DRAFT || bill.status === VendorBillStatus.VOID) return;

  const { apId, gstInputId, generalPurchasesId } = await getPurchasesAccountIds(db, userId);
  const creditApId = bill.accountsPayableAccountId ?? apId;

  const byExpense = new Map<string, Prisma.Decimal>();
  for (const line of bill.lines) {
    const aid = line.expenseAccountId ?? generalPurchasesId;
    const net = new Prisma.Decimal(line.lineNet);
    byExpense.set(aid, (byExpense.get(aid) ?? z()).add(net));
  }

  const taxTotal = new Prisma.Decimal(bill.taxTotal);
  const lines: { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[] = [];

  for (const [accountId, amt] of byExpense) {
    if (amt.gt(z())) lines.push({ accountId, debit: amt, credit: z() });
  }
  if (taxTotal.gt(z())) {
    lines.push({ accountId: gstInputId, debit: taxTotal, credit: z() });
  }
  lines.push({ accountId: creditApId, debit: z(), credit: new Prisma.Decimal(bill.total) });

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: bill.billDate,
      memo: `Bill ${bill.billNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.VENDOR_BILL,
      referenceId: bill.id,
      referenceNo: bill.billNumber,
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });

  await db.vendorBill.update({
    where: { id: bill.id },
    data: { journalEntryId: je.id },
  });
}

/** Dr AP, Cr Bank — allocation amounts must sum to payment.amount. */
export async function postVendorPaymentJournal(db: Db, userId: string, paymentId: string) {
  const pay = await db.vendorPayment.findFirst({
    where: { id: paymentId, userId },
    include: { allocations: true },
  });
  if (!pay || pay.journalEntryId) return;

  const allocSum = pay.allocations.reduce((s, a) => s.add(a.amount), z());
  if (!allocSum.eq(pay.amount)) {
    throw new Error("Payment allocations must equal payment amount.");
  }

  const { apId } = await getPurchasesAccountIds(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: pay.paymentDate,
      memo: pay.memo?.slice(0, 200) ?? `Payment ${pay.paymentNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.VENDOR_PAYMENT,
      referenceId: pay.id,
      referenceNo: pay.paymentNumber,
      lines: {
        create: [
          { accountId: apId, debit: pay.amount, credit: z() },
          { accountId: pay.bankAccountId, debit: z(), credit: pay.amount },
        ],
      },
    },
  });

  await db.vendorPayment.update({
    where: { id: pay.id },
    data: { journalEntryId: je.id },
  });
}

/** Vendor credit: Dr AP, Cr expense (returns). */
export async function postVendorCreditJournal(db: Db, userId: string, creditId: string) {
  const cr = await db.vendorCredit.findFirst({
    where: { id: creditId, userId },
  });
  if (!cr || cr.journalEntryId) return;

  const { apId } = await getPurchasesAccountIds(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: cr.issueDate,
      memo: cr.reason?.slice(0, 200) ?? `Vendor credit ${cr.creditNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.VENDOR_CREDIT,
      referenceId: cr.id,
      referenceNo: cr.creditNumber,
      lines: {
        create: [
          { accountId: apId, debit: cr.amount, credit: z() },
          { accountId: cr.expenseAccountId, debit: z(), credit: cr.amount },
        ],
      },
    },
  });

  await db.vendorCredit.update({
    where: { id: cr.id },
    data: { journalEntryId: je.id },
  });
}

export async function recalculateVendorBillStatus(db: Db, billId: string) {
  const bill = await db.vendorBill.findUnique({
    where: { id: billId },
    include: {
      paymentAllocations: true,
      creditApplications: true,
    },
  });
  if (!bill) return;
  if (bill.status === VendorBillStatus.VOID || bill.status === VendorBillStatus.DRAFT) return;

  const paid =
    bill.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
    bill.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
  const total = Number(bill.total);

  let status: VendorBillStatus;
  if (paid <= 0.005) status = VendorBillStatus.UNPAID;
  else if (paid + 0.005 >= total) status = VendorBillStatus.PAID;
  else status = VendorBillStatus.PARTIALLY_PAID;

  await db.vendorBill.update({
    where: { id: billId },
    data: { status },
  });
}
