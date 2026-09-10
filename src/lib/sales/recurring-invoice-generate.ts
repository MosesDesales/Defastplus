import { InvoiceStatus, Prisma, RecurringInvoiceStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postInvoiceIssuance } from "@/lib/accounting/posting";
import { dueDateFromPaymentTerms } from "@/lib/dates";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { advanceRecurringDate } from "@/lib/purchases/recurring-dates";
import { buildInvoiceLineRows } from "@/lib/sales/invoice-line-build";

export type GenerateRecurringResult =
  | { ok: true; invoiceId: string; invoiceNumber: string }
  | { ok: false; error: string };

/**
 * Creates a posted (SENT) invoice from a recurring template and advances `nextRunDate`.
 */
export async function generateInvoiceFromRecurringTemplate(
  prisma: PrismaClient,
  templateId: string,
  opts?: { force?: boolean; asOf?: Date },
): Promise<GenerateRecurringResult> {
  const now = opts?.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const tmpl = await tx.recurringInvoice.findFirst({
      where: { id: templateId },
      include: { lines: { orderBy: { sortOrder: "asc" } }, customer: true },
    });
    if (!tmpl) return { ok: false, error: "Template not found" };
    if (tmpl.status === RecurringInvoiceStatus.STOPPED) {
      return { ok: false, error: "Template is stopped" };
    }
    if (!opts?.force && tmpl.status !== RecurringInvoiceStatus.ACTIVE) {
      return { ok: false, error: "Template is not active" };
    }
    if (!opts?.force && tmpl.nextRunDate > now) {
      return { ok: false, error: "Next run date is in the future" };
    }
    if (tmpl.startDate > now) {
      return { ok: false, error: "Start date is in the future" };
    }
    if (tmpl.endDate && tmpl.endDate < now) {
      return { ok: false, error: "End date has passed" };
    }

    await ensureDefaultAccounts(tx, tmpl.userId);
    const companyProfile = await tx.companyProfile.findUnique({ where: { userId: tmpl.userId } });
    const companyGstin = companyProfile?.gstin ?? null;
    const lineInputs = tmpl.lines.map((l) => ({
      itemId: l.itemId,
      description: l.description,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
    }));
    const built = await buildInvoiceLineRows(tx, tmpl.userId, { gstin: tmpl.customer.gstin }, companyGstin, lineInputs);
    if (!built.ok) {
      return { ok: false, error: built.error };
    }

    const invoiceNumber = await getNextInvoiceNumber(tmpl.userId, tx);
    const clash = await tx.invoice.findUnique({
      where: { userId_invoiceNumber: { userId: tmpl.userId, invoiceNumber } },
    });
    if (clash) {
      return { ok: false, error: "Could not allocate invoice number" };
    }

    const inv = await tx.invoice.create({
      data: {
        userId: tmpl.userId,
        customerId: tmpl.customerId,
        invoiceNumber,
        reference: `Recurring: ${(tmpl.profileName || "Schedule").trim()}`.slice(0, 200),
        issueDate: now,
        dueDate: dueDateFromPaymentTerms(now, tmpl.customer.paymentTerms),
        status: InvoiceStatus.SENT,
        currency: tmpl.customer.currency?.trim() || "INR",
        subTotal: new Prisma.Decimal(built.subTotal),
        taxTotal: new Prisma.Decimal(built.taxTotal),
        total: new Prisma.Decimal(built.total),
        discountPercent: new Prisma.Decimal(0),
        withholdingType: "NONE",
        withholdingPercent: new Prisma.Decimal(0),
        adjustmentLabel: "Adjustment",
        adjustmentAmount: new Prisma.Decimal(0),
        payableTotal: new Prisma.Decimal(built.total),
        recurringInvoiceId: tmpl.id,
        lines: { create: built.lineRows },
      },
    });

    await postInvoiceIssuance(tx, tmpl.userId, inv.id);

    const next = advanceRecurringDate(tmpl.nextRunDate, tmpl.frequency, tmpl.repeatEvery);
    let newStatus: RecurringInvoiceStatus = tmpl.status;
    if (tmpl.endDate && next > tmpl.endDate) {
      newStatus = RecurringInvoiceStatus.STOPPED;
    }

    await tx.recurringInvoice.update({
      where: { id: tmpl.id },
      data: {
        nextRunDate: next,
        lastGeneratedAt: now,
        status: newStatus,
      },
    });

    return { ok: true, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber };
  });
}
