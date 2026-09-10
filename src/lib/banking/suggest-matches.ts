import { InvoiceStatus, VendorBillStatus, type PrismaClient } from "@prisma/client";

import { getAllocatedTotalForInvoice } from "@/lib/accounting/invoice-balance";
import { isInflow, remainingToMap, appliedFromMappings } from "@/lib/banking/transaction-amounts";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";

export type MatchSuggestion = {
  moduleType: "INVOICE" | "BILL" | "VENDOR_PAYMENT";
  moduleId: string;
  label: string;
  amount: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score: number;
};

async function billOpen(db: PrismaClient, billId: string): Promise<number> {
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

export async function suggestBankingMatches(
  db: PrismaClient,
  userId: string,
  bankingTransactionId: string,
): Promise<MatchSuggestion[]> {
  const txn = await db.bankingTransaction.findFirst({
    where: { id: bankingTransactionId, userId },
    include: { mappings: true },
  });
  if (!txn) return [];

  const remaining = remainingToMap(txn, appliedFromMappings(txn.mappings));
  if (remaining < 0.01) return [];

  const suggestions: MatchSuggestion[] = [];
  const amt = remaining;
  const ref = (txn.reference ?? "").toLowerCase();
  const desc = txn.description.toLowerCase();

  if (isInflow(txn)) {
    const invoices = await db.invoice.findMany({
      where: {
        userId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
      },
      take: 80,
      orderBy: { dueDate: "asc" },
      include: { customer: { select: { displayName: true } } },
    });
    for (const inv of invoices) {
      const already = await getAllocatedTotalForInvoice(db, inv.id);
      const open = invoiceOpenAmount(inv) - already;
      if (open < 0.01) continue;
      let score = 0;
      if (Math.abs(open - amt) < 0.05) score += 50;
      else if (Math.abs(open - amt) < open * 0.05) score += 35;
      if (inv.invoiceNumber.toLowerCase() && ref.includes(inv.invoiceNumber.toLowerCase())) score += 40;
      if (inv.reference && ref.includes(inv.reference.toLowerCase())) score += 25;
      if (desc.includes(inv.customer.displayName.toLowerCase().slice(0, 8))) score += 15;
      const days = Math.abs(txn.txnDate.getTime() - inv.issueDate.getTime()) / 86400000;
      if (days <= 3) score += 10;
      else if (days <= 14) score += 5;
      if (score < 15) continue;
      const confidence = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
      suggestions.push({
        moduleType: "INVOICE",
        moduleId: inv.id,
        label: `${inv.invoiceNumber} · ${inv.customer.displayName}`,
        amount: Math.min(amt, open),
        confidence,
        score,
      });
    }
  } else {
    const bills = await db.vendorBill.findMany({
      where: {
        userId,
        status: { in: [VendorBillStatus.UNPAID, VendorBillStatus.PARTIALLY_PAID] },
      },
      take: 80,
      orderBy: { billDate: "desc" },
      include: { vendor: { select: { displayName: true } } },
    });
    for (const bill of bills) {
      const open = await billOpen(db, bill.id);
      if (open < 0.01) continue;
      let score = 0;
      if (Math.abs(open - amt) < 0.05) score += 50;
      else if (Math.abs(open - amt) < open * 0.05) score += 35;
      if (bill.billNumber.toLowerCase() && ref.includes(bill.billNumber.toLowerCase())) score += 40;
      if (bill.reference && ref.includes(bill.reference.toLowerCase())) score += 25;
      if (desc.includes(bill.vendor.displayName.toLowerCase().slice(0, 8))) score += 15;
      const days = Math.abs(txn.txnDate.getTime() - bill.billDate.getTime()) / 86400000;
      if (days <= 3) score += 10;
      else if (days <= 21) score += 5;
      if (score < 15) continue;
      const confidence = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
      suggestions.push({
        moduleType: "BILL",
        moduleId: bill.id,
        label: `${bill.billNumber} · ${bill.vendor.displayName}`,
        amount: Math.min(amt, open),
        confidence,
        score,
      });
    }

    const vps = await db.vendorPayment.findMany({
      where: { userId },
      orderBy: { paymentDate: "desc" },
      take: 40,
      include: { vendor: { select: { displayName: true } } },
    });
    for (const vp of vps) {
      const pAmt = Number(vp.amount);
      if (Math.abs(pAmt - amt) > 0.05) continue;
      let score = 45;
      if (vp.reference && ref.includes(vp.reference.toLowerCase())) score += 25;
      suggestions.push({
        moduleType: "VENDOR_PAYMENT",
        moduleId: vp.id,
        label: `${vp.paymentNumber} · ${vp.vendor.displayName}`,
        amount: pAmt,
        confidence: score >= 65 ? "HIGH" : "MEDIUM",
        score,
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 12);
}
