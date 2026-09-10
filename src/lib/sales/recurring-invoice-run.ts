import { RecurringInvoiceStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { generateInvoiceFromRecurringTemplate } from "@/lib/sales/recurring-invoice-generate";

/** Daily cron: create invoices for due active recurring templates. */
export async function runRecurringInvoices(prisma: PrismaClient) {
  const now = new Date();
  let invoicesCreated = 0;

  const rows = await prisma.recurringInvoice.findMany({
    where: {
      status: RecurringInvoiceStatus.ACTIVE,
      nextRunDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      NOT: {
        user: {
          organizationSettings: {
            recurringInvoiceEnabled: false,
          },
        },
      },
    },
    select: { id: true },
  });

  for (const r of rows) {
    const res = await generateInvoiceFromRecurringTemplate(prisma, r.id);
    if (res.ok) invoicesCreated += 1;
  }

  return { invoicesCreated };
}
