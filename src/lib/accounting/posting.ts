import {
  CreditNoteStatus,
  InvoiceStatus,
  JournalPostingStatus,
  JournalReferenceKind,
  Prisma,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getSystemAccountIds } from "@/lib/accounting/default-accounts";

type Db = PrismaClient | Prisma.TransactionClient;

function z() {
  return new Prisma.Decimal(0);
}

/** Issue-side posting: Dr AR (total), Cr Revenue (net), Cr Tax (tax). */
export async function postInvoiceIssuance(db: Db, userId: string, invoiceId: string) {
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
  });
  if (!inv || inv.issuanceJournalId) {
    return;
  }
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
    return;
  }

  const { arId, salesId, taxId } = await getSystemAccountIds(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: inv.issueDate,
      memo: `Invoice ${inv.invoiceNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.INVOICE_ISSUE,
      referenceId: inv.id,
      lines: {
        create: [
          { accountId: arId, debit: inv.total, credit: z() },
          { accountId: salesId, debit: z(), credit: inv.subTotal },
          { accountId: taxId, debit: z(), credit: inv.taxTotal },
        ],
      },
    },
  });

  await db.invoice.update({
    where: { id: inv.id },
    data: { issuanceJournalId: je.id },
  });
}

/** Receipt: Dr Bank, Cr AR (clears customer balance at GL level). */
export async function postPaymentReceipt(db: Db, userId: string, paymentId: string) {
  const pay = await db.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!pay || pay.receiptJournalId) {
    return;
  }

  const { bankId, arId } = await getSystemAccountIds(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: pay.paymentDate,
      memo: `Payment ${pay.paymentNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.PAYMENT_RECEIPT,
      referenceId: pay.id,
      lines: {
        create: [
          { accountId: bankId, debit: pay.amount, credit: z() },
          { accountId: arId, debit: z(), credit: pay.amount },
        ],
      },
    },
  });

  await db.payment.update({
    where: { id: pay.id },
    data: { receiptJournalId: je.id },
  });
}

/** Credit note (issued): Dr Sales (net), Dr Output tax, Cr AR (total) — reverses revenue side of invoice pattern. */
export async function postCreditNoteJournal(db: Db, userId: string, creditNoteId: string) {
  const cn = await db.creditNote.findFirst({
    where: { id: creditNoteId, userId },
  });
  if (!cn || cn.reversalJournalId) {
    return;
  }
  if (cn.status !== CreditNoteStatus.OPEN) {
    return;
  }

  const { arId, salesId, taxId } = await getSystemAccountIds(db, userId);

  const je = await db.journalEntry.create({
    data: {
      userId,
      entryDate: cn.issueDate,
      memo: `Credit note ${cn.creditNumber}`,
      postingStatus: JournalPostingStatus.POSTED,
      referenceKind: JournalReferenceKind.CREDIT_NOTE,
      referenceId: cn.id,
      referenceNo: cn.creditNumber,
      lines: {
        create: [
          { accountId: salesId, debit: cn.subTotal, credit: z() },
          { accountId: taxId, debit: cn.taxTotal, credit: z() },
          { accountId: arId, debit: z(), credit: cn.total },
        ],
      },
    },
  });

  await db.creditNote.update({
    where: { id: cn.id },
    data: { reversalJournalId: je.id },
  });
}
