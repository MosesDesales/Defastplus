import { Prisma, VendorBillStatus } from "@prisma/client";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postPurchaseExpenseJournal, postVendorBillJournal } from "@/lib/accounting/purchases-posting";
import { resolveDocumentCurrencyForSave } from "@/lib/currencies/document-currency";
import { computeBillLineAmounts, round2 } from "@/lib/purchases/line-math";
import { advanceRecurringDate } from "@/lib/purchases/recurring-dates";
import { dueDateFromPaymentTerms } from "@/lib/dates";
import type { PrismaClient } from "@prisma/client";

/** Generates due recurring expenses and bills. Returns counts for logging. */
export async function runRecurringPurchases(prisma: PrismaClient) {
  const now = new Date();
  let expensesCreated = 0;
  let billsCreated = 0;

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      isActive: true,
      nextRunDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      NOT: {
        user: {
          organizationSettings: {
            recurringExpenseEnabled: false,
          },
        },
      },
    },
  });

  for (const r of recurringExpenses) {
    if (r.startDate > now) continue;

    await prisma.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, r.userId);
      const ex = await tx.purchaseExpense.create({
        data: {
          userId: r.userId,
          expenseDate: now,
          expenseAccountId: r.expenseAccountId,
          bankAccountId: r.bankAccountId,
          vendorId: r.vendorId,
          customerId: r.customerId,
          amount: r.amount,
          taxAmount: r.taxAmount,
          notes: r.notes ? `Recurring: ${r.notes}` : "Recurring expense",
        },
      });
      await postPurchaseExpenseJournal(tx, r.userId, ex.id);

      const next = advanceRecurringDate(r.nextRunDate, r.frequency, 1);
      await tx.recurringExpense.update({
        where: { id: r.id },
        data: {
          nextRunDate: next,
          lastGeneratedAt: now,
        },
      });
    });
    expensesCreated += 1;
  }

  const recurringBills = await prisma.recurringVendorBill.findMany({
    where: {
      isActive: true,
      nextRunDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      NOT: {
        user: {
          organizationSettings: {
            recurringBillsEnabled: false,
          },
        },
      },
    },
    include: { lines: true, vendor: true },
  });

  for (const rb of recurringBills) {
    if (rb.startDate > now) continue;

    await prisma.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, rb.userId);

      const docDiscFactor = Math.max(0, 1 - Number(rb.discountPercent ?? 0) / 100);

      let subTotal = 0;
      let taxTotal = 0;
      let lineTotalsSum = 0;
      const lineRows: Array<{
        itemId: string | null;
        customerId: string | null;
        description: string;
        quantity: Prisma.Decimal;
        rate: Prisma.Decimal;
        discountPercent: Prisma.Decimal;
        taxPercent: Prisma.Decimal;
        lineNet: Prisma.Decimal;
        lineTax: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        expenseAccountId: string | null;
        sortOrder: number;
      }> = [];

      rb.lines.forEach((l, i) => {
        const qty = Number(l.quantity);
        const rate = Number(l.rate) * docDiscFactor;
        const taxP = Number(l.taxPercent);
        const discP = Number(l.discountPercent);
        const { lineNet, lineTax, lineTotal } = computeBillLineAmounts(qty, rate, discP, taxP);
        subTotal += Number(lineNet);
        taxTotal += Number(lineTax);
        lineTotalsSum += Number(lineTotal);
        lineRows.push({
          itemId: l.itemId,
          customerId: l.customerId,
          description: l.description,
          quantity: new Prisma.Decimal(qty),
          rate: new Prisma.Decimal(Number(l.rate) * docDiscFactor),
          discountPercent: new Prisma.Decimal(discP),
          taxPercent: new Prisma.Decimal(taxP),
          lineNet,
          lineTax,
          lineTotal,
          expenseAccountId: l.expenseAccountId,
          sortOrder: l.sortOrder ?? i,
        });
      });

      const adj = Number(rb.adjustmentAmount ?? 0);
      const wh = Number(rb.withholdingAmount ?? 0);
      const grandTotal = round2(lineTotalsSum + adj - wh);

      const paymentTerms = rb.paymentTerms?.trim() || "DUE_ON_RECEIPT";
      const dueDate = dueDateFromPaymentTerms(now, paymentTerms);

      const n = await tx.vendorBill.count({ where: { userId: rb.userId } });
      const billNumber = `RB-${String(n + 1).padStart(5, "0")}`;
      const profileLabel = rb.profileName?.trim() || "Bill";
      const fx = await resolveDocumentCurrencyForSave(tx, rb.userId, {
        partyDefaultCurrency: rb.vendor.currency,
      });

      const bill = await tx.vendorBill.create({
        data: {
          userId: rb.userId,
          vendorId: rb.vendorId,
          billNumber,
          reference: `Recurring: ${profileLabel}`,
          billDate: now,
          dueDate,
          paymentTerms,
          accountsPayableAccountId: rb.accountsPayableAccountId,
          notesInternal: rb.notesInternal,
          status: VendorBillStatus.UNPAID,
          currency: fx.currency,
          exchangeRate: fx.exchangeRateDecimal,
          baseTotal: fx.baseTotalDecimal(grandTotal),
          subTotal: new Prisma.Decimal(subTotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          total: new Prisma.Decimal(grandTotal),
          withholdingType: rb.withholdingType ?? "NONE",
          withholdingAmount: new Prisma.Decimal(wh),
          adjustmentAmount: new Prisma.Decimal(adj),
          lines: { create: lineRows },
        },
      });

      await postVendorBillJournal(tx, rb.userId, bill.id);

      const next = advanceRecurringDate(rb.nextRunDate, rb.frequency, 1);
      await tx.recurringVendorBill.update({
        where: { id: rb.id },
        data: {
          nextRunDate: next,
          lastGeneratedAt: now,
        },
      });
    });
    billsCreated += 1;
  }

  return { expensesCreated, billsCreated };
}
