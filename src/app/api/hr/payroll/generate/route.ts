import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { requireApiModules } from "@/lib/api-require-module";
import { computeSalaryBreakdown } from "@/lib/hr/payroll-calc";
import { computeLeaveSummary } from "@/lib/hr/leave-calc";
import { postPayrollAccrualJournal } from "@/lib/accounting/payroll-posting";
import { buildAttachmentPdf } from "@/lib/email/attachment-pdf";
import { createMailTransport, getFromAddress } from "@/lib/email/mailer";
import { writeAuditLog } from "@/lib/audit";

/** POST — run payroll for a month: generates payslips, posts the accrual journal, and emails each payslip. */
export async function POST(request: Request) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;
  const denied = await requireApiModules(session.sub, "payroll");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const yearMonth = String((json as { yearMonth?: string }).yearMonth ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return NextResponse.json({ error: "yearMonth YYYY-MM required" }, { status: 400 });

  const existingRun = await prisma.payrollRun.findUnique({
    where: { userId_yearMonth: { userId: session.sub, yearMonth } },
  });

  if (existingRun?.status === "APPROVED" || existingRun?.status === "PAID") {
    return NextResponse.json({ error: "Payroll already finalized for this month" }, { status: 409 });
  }

  const employees = await prisma.employee.findMany({
    where: { userId: session.sub, isActive: true, salaryStructureId: { not: null } },
    include: {
      salaryStructure: {
        include: { components: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const run = await prisma.$transaction(async (tx) => {
    const r = await tx.payrollRun.upsert({
      where: { userId_yearMonth: { userId: session.sub, yearMonth } },
      create: {
        userId: session.sub,
        yearMonth,
        status: "APPROVED",
      },
      update: {
        status: "APPROVED",
        journalEntryId: null,
      },
    });

    await tx.payslip.deleteMany({ where: { payrollRunId: r.id } });

    for (const emp of employees) {
      const structure = emp.salaryStructure;
      if (!structure) continue;

      const comps = structure.components.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        amountType: c.amountType,
        amount: Number(c.amount),
        percentOfBasic: c.percentOfBasic != null ? Number(c.percentOfBasic) : null,
        sortOrder: c.sortOrder,
      }));

      const calc = computeSalaryBreakdown(comps);
      const leave = await computeLeaveSummary(session.sub, emp.id, yearMonth);

      await tx.payslip.create({
        data: {
          payrollRunId: r.id,
          employeeId: emp.id,
          gross: new Prisma.Decimal(calc.gross),
          totalDeductions: new Prisma.Decimal(calc.totalDeductions),
          netPay: new Prisma.Decimal(calc.netPay),
          breakdown: calc.lines as unknown as Prisma.InputJsonValue,
          daysPaid: new Prisma.Decimal(leave.daysPaid),
          leaveSummary: leave.lines as unknown as Prisma.InputJsonValue,
        },
      });
    }

    await postPayrollAccrualJournal(tx, session.sub, r.id);

    return r;
  });

  await writeAuditLog(session.sub, "PAYROLL_GENERATE", "PayrollRun", run.id, { yearMonth });

  const finalRun = await prisma.payrollRun.findUniqueOrThrow({ where: { id: run.id } });

  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: run.id },
    include: { employee: true },
  });

  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  const transporter = createMailTransport();
  const from = getFromAddress();

  if (transporter && from) {
    for (const p of payslips) {
      if (!p.employee.email) {
        emailsSkipped++;
        continue;
      }
      try {
        const pdf = await buildAttachmentPdf(session.sub, "payslip", p.id);
        if (!pdf) {
          emailsSkipped++;
          continue;
        }
        await transporter.sendMail({
          from,
          to: p.employee.email,
          subject: `Payslip — ${yearMonth}`,
          text: `Hi ${p.employee.displayName},\n\nPlease find your payslip for ${yearMonth} attached.\n\nRegards,`,
          attachments: [{ filename: pdf.filename, content: pdf.buffer }],
        });
        emailsSent++;
      } catch (e) {
        console.error(e);
        emailsFailed++;
      }
    }
  } else {
    emailsSkipped = payslips.length;
  }

  await writeAuditLog(session.sub, "PAYROLL_PAYSLIPS_EMAILED", "PayrollRun", run.id, {
    emailsSent,
    emailsSkipped,
    emailsFailed,
  });

  return NextResponse.json({
    payrollRunId: run.id,
    yearMonth,
    payslipCount: payslips.length,
    journalPosted: Boolean(finalRun.journalEntryId),
    emailsSent,
    emailsSkipped,
    emailsFailed,
    smtpConfigured: Boolean(transporter && from),
  });
}
