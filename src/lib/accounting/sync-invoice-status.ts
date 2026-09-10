import { InvoiceStatus } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { invoiceOpenAmount } from "@/lib/sales/invoice-document-summary";

type Db = PrismaClient | Prisma.TransactionClient;

export async function syncInvoicePaymentStatus(db: Db, invoiceId: string) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { allocations: true, creditNoteApplications: true },
  });
  if (!inv || inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
    return;
  }

  const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const creditsApplied = inv.creditNoteApplications.reduce((s, a) => s + Number(a.amount), 0);
  const cleared = paid + creditsApplied;
  const due = invoiceOpenAmount(inv);
  let next: InvoiceStatus = InvoiceStatus.SENT;
  if (cleared >= due - 0.005) {
    next = InvoiceStatus.PAID;
  } else if (cleared > 0.005) {
    next = InvoiceStatus.PARTIALLY_PAID;
  }

  if (next !== inv.status) {
    await db.invoice.update({ where: { id: invoiceId }, data: { status: next } });
  }
}
