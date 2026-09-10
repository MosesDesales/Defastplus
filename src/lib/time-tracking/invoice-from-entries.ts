import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { InvoiceStatus } from "@prisma/client";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { parseYmd } from "@/lib/dates";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { computeInvoiceSummaryView } from "@/lib/sales/invoice-document-summary";
import { buildInvoiceLineRows, type LineInput } from "@/lib/sales/invoice-line-build";
import { resolveInvoiceTemplateId } from "@/lib/document-templates-service";

const DAY_SEC = 86400;

export function hoursFromSeconds(sec: number): number {
  return Math.round((sec / 3600) * 100) / 100;
}

export async function sumDurationForEmployeeDay(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  employeeId: string,
  workDate: Date,
  excludeEntryId?: string,
): Promise<number> {
  const start = new Date(workDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const rows = await db.timeEntry.findMany({
    where: {
      userId,
      employeeId,
      workDate: { gte: start, lt: end },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { durationSeconds: true, isRunning: true },
  });
  let t = 0;
  for (const r of rows) {
    t += r.durationSeconds;
  }
  return t;
}

export async function assertDailyCap(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  employeeId: string,
  workDate: Date,
  addSeconds: number,
  excludeEntryId?: string,
) {
  const cur = await sumDurationForEmployeeDay(db, userId, employeeId, workDate, excludeEntryId);
  if (cur + addSeconds > DAY_SEC) {
    throw new Error("Total time for this day cannot exceed 24 hours.");
  }
}

/** Returns true if [aStart,aEnd] overlaps any finalized interval for same employee. */
export async function hasOverlap(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  employeeId: string,
  aStart: Date,
  aEnd: Date,
  excludeEntryId?: string,
): Promise<boolean> {
  const others = await db.timeEntry.findMany({
    where: {
      userId,
      employeeId,
      isRunning: false,
      endedAt: { not: null },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { startedAt: true, endedAt: true },
  });
  for (const o of others) {
    const s = o.startedAt;
    const e = o.endedAt;
    if (!s || !e) continue;
    if (aStart < e && aEnd > s) return true;
  }
  return false;
}

export async function createInvoiceFromTimeEntries(
  db: PrismaClient,
  userId: string,
  entryIds: string[],
  opts?: { taxPercent?: number; issueDate?: string; dueDate?: string | null },
): Promise<{ ok: true; invoiceId: string; invoiceNumber: string } | { ok: false; error: string }> {
  const entries = await db.timeEntry.findMany({
    where: { id: { in: entryIds }, userId },
    include: {
      project: { include: { customer: true } },
      task: true,
    },
  });
  if (entries.length !== entryIds.length) {
    return { ok: false, error: "One or more time entries were not found." };
  }
  for (const e of entries) {
    if (e.invoiceId) return { ok: false, error: "Some entries are already invoiced." };
    if (!e.billable) return { ok: false, error: "Only billable entries can be invoiced." };
    if (!e.projectId || !e.project) return { ok: false, error: "Each entry must belong to a project." };
    if (e.durationSeconds <= 0) return { ok: false, error: "Entries must have logged duration." };
    if (e.timesheetId) {
      const ts = await db.timesheet.findFirst({ where: { id: e.timesheetId, userId } });
      if (ts && ts.status !== "APPROVED") {
        return { ok: false, error: "Timesheet-linked entries must be approved before invoicing." };
      }
    }
  }
  const customerId = entries[0]!.project!.customerId;
  for (const e of entries) {
    if (e.project!.customerId !== customerId) {
      return { ok: false, error: "All entries must belong to the same customer." };
    }
  }

  const customer = await db.customer.findFirst({ where: { id: customerId, userId } });
  if (!customer) return { ok: false, error: "Customer not found." };

  const byProject = new Map<string, { name: string; seconds: number; rate: number }>();
  for (const e of entries) {
    const p = e.project!;
    const prev = byProject.get(p.id) ?? { name: p.name, seconds: 0, rate: Number(p.hourlyRate) };
    prev.seconds += e.durationSeconds;
    byProject.set(p.id, prev);
  }

  const lines: LineInput[] = [];
  for (const [, v] of byProject) {
    const hrs = hoursFromSeconds(v.seconds);
    if (hrs <= 0) continue;
    lines.push({
      description: `${v.name} — ${hrs} h`,
      quantity: hrs,
      rate: v.rate,
      taxPercent: opts?.taxPercent ?? 0,
    });
  }
  if (!lines.length) return { ok: false, error: "Nothing to invoice." };

  const companyProfile = await db.companyProfile.findUnique({ where: { userId } });
  const companyGstin = companyProfile?.gstin ?? null;
  const built = await buildInvoiceLineRows(db, userId, customer, companyGstin, lines);
  if (!built.ok) return { ok: false, error: built.error };

  const issueDate = opts?.issueDate ? parseYmd(opts.issueDate) : new Date();
  if (Number.isNaN(issueDate.getTime())) return { ok: false, error: "Invalid issue date." };
  let dueDate: Date | null = null;
  if (opts?.dueDate?.trim()) {
    const d = parseYmd(opts.dueDate.trim());
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid due date." };
    dueDate = d;
  }

  const invoiceNumber = await getNextInvoiceNumber(userId, db);
  const summaryView = computeInvoiceSummaryView(built.subTotal, built.taxTotal, "Adjustment", {
    discountPercent: 0,
    withholdingType: "NONE",
    withholdingPercent: 0,
    adjustmentAmount: 0,
  });
  const documentTemplateId = await resolveInvoiceTemplateId(db, userId, null);

  try {
    const inv = await db.$transaction(async (tx) => {
      await ensureDefaultAccounts(tx, userId);
      const invoice = await tx.invoice.create({
        data: {
          userId,
          customerId,
          documentTemplateId,
          invoiceNumber,
          reference: `Time tracking (${entries.length} entries)`,
          issueDate,
          dueDate,
          status: InvoiceStatus.DRAFT,
          currency: customer.currency ?? "INR",
          subTotal: new Prisma.Decimal(built.subTotal),
          taxTotal: new Prisma.Decimal(built.taxTotal),
          total: new Prisma.Decimal(built.total),
          discountPercent: new Prisma.Decimal(summaryView.discountPercent),
          withholdingType: summaryView.withholdingType,
          withholdingPercent: new Prisma.Decimal(summaryView.withholdingPercent),
          adjustmentLabel: summaryView.adjustmentLabel,
          adjustmentAmount: new Prisma.Decimal(summaryView.adjustmentAmount),
          payableTotal: new Prisma.Decimal(summaryView.payableTotal),
          lines: { create: built.lineRows },
        },
      });
      await tx.timeEntry.updateMany({
        where: { id: { in: entryIds }, userId },
        data: { invoiceId: invoice.id },
      });
      return invoice;
    });
    return { ok: true, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create invoice." };
  }
}
