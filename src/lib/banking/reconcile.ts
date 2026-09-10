import {
  BankingMappingModuleType,
  InvoiceStatus,
  Prisma,
  VendorBillStatus,
  type PrismaClient,
} from "@prisma/client";

import { getAllocatedTotalForInvoice } from "@/lib/accounting/invoice-balance";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postPaymentReceipt } from "@/lib/accounting/posting";
import { postPurchaseExpenseJournal, postVendorPaymentJournal, recalculateVendorBillStatus } from "@/lib/accounting/purchases-posting";
import { syncInvoicePaymentStatus } from "@/lib/accounting/sync-invoice-status";
import { refreshBankingTransactionStatus } from "@/lib/banking/refresh-status";
import { appliedFromMappings, isInflow, remainingToMap } from "@/lib/banking/transaction-amounts";
import { getNextPaymentNumber } from "@/lib/payment-number";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";

type Db = PrismaClient | import("@prisma/client").Prisma.TransactionClient;

export type BankingMatchInput = {
  moduleType: BankingMappingModuleType;
  moduleId: string;
  amount: number;
  expenseAccountId?: string | null;
};

async function vendorBillOpen(db: Db, billId: string): Promise<number> {
  const bill = await db.vendorBill.findUnique({
    where: { id: billId },
    include: { paymentAllocations: true, creditApplications: true },
  });
  if (!bill) return 0;
  const paid =
    bill.paymentAllocations.reduce((s, a) => s + Number(a.amount), 0) +
    bill.creditApplications.reduce((s, a) => s + Number(a.amount), 0);
  return Number(bill.total) - paid;
}

async function nextVendorPaymentNumber(db: import("@prisma/client").Prisma.TransactionClient | PrismaClient, userId: string): Promise<string> {
  const n = await db.vendorPayment.count({ where: { userId } });
  return `VPAY-${String(n + 1).padStart(5, "0")}`;
}

export async function applyBankingMatches(
  db: PrismaClient,
  userId: string,
  bankingTransactionId: string,
  matches: BankingMatchInput[],
): Promise<{ mappingIds: string[] }> {
  if (!matches.length) throw new Error("No matches");

  return await db.$transaction(async (tx) => {
    const txn = await tx.bankingTransaction.findFirst({
      where: { id: bankingTransactionId, userId },
      include: { mappings: true, bankingAccount: true },
    });
    if (!txn) throw new Error("Transaction not found");

    let appliedSoFar = appliedFromMappings(txn.mappings);
    let sumNew = 0;
    for (const m of matches) {
      if (m.amount <= 0) throw new Error("Amount must be positive");
      sumNew += m.amount;
    }
    if (sumNew > remainingToMap(txn, appliedSoFar) + 0.02) {
      throw new Error("Total mapped amount exceeds the bank line amount");
    }

    await ensureDefaultAccounts(tx, userId);

    const mappingIds: string[] = [];

    for (const m of matches) {
      if (m.moduleType === BankingMappingModuleType.INVOICE) {
        if (!isInflow(txn)) throw new Error("Invoice payments can only be matched to deposit (credit) lines");
        const inv = await tx.invoice.findFirst({
          where: { id: m.moduleId, userId },
          include: { allocations: true, creditNoteApplications: true },
        });
        if (!inv) throw new Error("Invoice not found");
        if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
          throw new Error("Invoice cannot receive payments in its current status");
        }
        const already = await getAllocatedTotalForInvoice(tx, inv.id);
        const remainingInv = invoiceOpenAmount(inv) - already;
        if (m.amount > remainingInv + 0.02) throw new Error("Amount exceeds open balance on invoice");

        const paymentNumber = await getNextPaymentNumber(userId);
        const pay = await tx.payment.create({
          data: {
            userId,
            customerId: inv.customerId,
            paymentNumber,
            paymentDate: txn.txnDate,
            mode: "BANK",
            reference: txn.reference?.trim() || `Bank import ${txn.id.slice(0, 8)}`,
            memo: `Bank: ${txn.description.slice(0, 200)}`,
            amount: new Prisma.Decimal(m.amount),
            allocations: { create: [{ invoiceId: inv.id, amount: new Prisma.Decimal(m.amount) }] },
          },
        });
        await postPaymentReceipt(tx, userId, pay.id);
        await syncInvoicePaymentStatus(tx, inv.id);

        const mapRow = await tx.bankingTransactionMapping.create({
          data: {
            bankingTransactionId: txn.id,
            moduleType: BankingMappingModuleType.INVOICE,
            moduleId: inv.id,
            amountApplied: new Prisma.Decimal(m.amount),
            createdPaymentId: pay.id,
          },
        });
        mappingIds.push(mapRow.id);
      } else if (m.moduleType === BankingMappingModuleType.BILL) {
        if (isInflow(txn)) throw new Error("Bills are paid from withdrawal (debit) lines");
        if (!txn.bankingAccount.chartAccountId) {
          throw new Error("Link this bank account to a chart-of-accounts bank account before paying bills");
        }
        const bill = await tx.vendorBill.findFirst({
          where: { id: m.moduleId, userId },
          include: { paymentAllocations: true, creditApplications: true },
        });
        if (!bill) throw new Error("Bill not found");
        if (bill.status === VendorBillStatus.VOID || bill.status === VendorBillStatus.DRAFT) {
          throw new Error("Bill cannot be paid in its current status");
        }
        const open = await vendorBillOpen(tx, bill.id);
        if (m.amount > open + 0.02) throw new Error("Amount exceeds open balance on bill");

        const paymentNumber = await nextVendorPaymentNumber(tx, userId);
        const pay = await tx.vendorPayment.create({
          data: {
            userId,
            vendorId: bill.vendorId,
            paymentNumber,
            paymentDate: txn.txnDate,
            mode: "BANK",
            reference: txn.reference?.trim() || null,
            memo: `Bank: ${txn.description.slice(0, 200)}`,
            amount: new Prisma.Decimal(m.amount),
            bankAccountId: txn.bankingAccount.chartAccountId,
            allocations: { create: [{ billId: bill.id, amount: new Prisma.Decimal(m.amount) }] },
          },
        });
        await postVendorPaymentJournal(tx, userId, pay.id);
        await recalculateVendorBillStatus(tx, bill.id);

        const mapRow = await tx.bankingTransactionMapping.create({
          data: {
            bankingTransactionId: txn.id,
            moduleType: BankingMappingModuleType.BILL,
            moduleId: bill.id,
            amountApplied: new Prisma.Decimal(m.amount),
            createdVendorPaymentId: pay.id,
          },
        });
        mappingIds.push(mapRow.id);
      } else if (m.moduleType === BankingMappingModuleType.EXPENSE) {
        if (isInflow(txn)) throw new Error("Expenses are recorded on withdrawal (debit) lines");
        if (!txn.bankingAccount.chartAccountId) {
          throw new Error("Link this bank account to a chart-of-accounts bank account before recording expenses");
        }
        const expAcct = m.expenseAccountId?.trim();
        if (!expAcct) throw new Error("expenseAccountId is required for expense matches");
        const acctOk = await tx.account.findFirst({
          where: { id: expAcct, userId, isActive: true },
        });
        if (!acctOk) throw new Error("Invalid expense account");

        const ex = await tx.purchaseExpense.create({
          data: {
            userId,
            expenseDate: txn.txnDate,
            expenseAccountId: expAcct,
            bankAccountId: txn.bankingAccount.chartAccountId,
            vendorId: null,
            customerId: null,
            invoiceNumber: null,
            amount: new Prisma.Decimal(m.amount),
            taxAmount: new Prisma.Decimal(0),
            notes: `Bank: ${txn.description.slice(0, 400)}`,
            attachmentUrl: null,
          },
        });
        await postPurchaseExpenseJournal(tx, userId, ex.id);

        const mapRow = await tx.bankingTransactionMapping.create({
          data: {
            bankingTransactionId: txn.id,
            moduleType: BankingMappingModuleType.EXPENSE,
            moduleId: ex.id,
            amountApplied: new Prisma.Decimal(m.amount),
            createdExpenseId: ex.id,
          },
        });
        mappingIds.push(mapRow.id);
      } else if (m.moduleType === BankingMappingModuleType.VENDOR_PAYMENT) {
        if (isInflow(txn)) throw new Error("Vendor payments are matched on withdrawal (debit) lines");
        const vp = await tx.vendorPayment.findFirst({
          where: { id: m.moduleId, userId },
        });
        if (!vp) throw new Error("Vendor payment not found");
        if (Math.abs(Number(vp.amount) - m.amount) > 0.05) {
          throw new Error("Mapped amount should match the vendor payment amount");
        }
        const mapRow = await tx.bankingTransactionMapping.create({
          data: {
            bankingTransactionId: txn.id,
            moduleType: BankingMappingModuleType.VENDOR_PAYMENT,
            moduleId: vp.id,
            amountApplied: new Prisma.Decimal(m.amount),
          },
        });
        mappingIds.push(mapRow.id);
      } else {
        throw new Error("Unsupported module type");
      }
    }

    await refreshBankingTransactionStatus(tx, bankingTransactionId);
    await tx.bankingAccount.update({
      where: { id: txn.bankingAccountId },
      data: { lastSyncedAt: new Date() },
    });

    return { mappingIds };
  });
}
