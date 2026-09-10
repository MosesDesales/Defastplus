import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { buildAttachmentPdf } from "@/lib/email/attachment-pdf";
import { createMailTransport, getFromAddress } from "@/lib/email/mailer";
import { writeAuditLog } from "@/lib/audit";

type P = { params: Promise<{ id: string; payslipId: string }> };

/** POST — (re)send one employee's payslip email on demand. */
export async function POST(_request: Request, props: P) {
  const session = await requireApiPermission("payroll.edit");
  if (session instanceof NextResponse) return session;
  const { id: runId, payslipId } = await props.params;

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, userId: session.sub } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, payrollRunId: runId },
    include: { employee: true },
  });
  if (!payslip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!payslip.employee.email) return NextResponse.json({ error: "This employee has no email on file" }, { status: 400 });

  const transporter = createMailTransport();
  const from = getFromAddress();
  if (!transporter || !from) return NextResponse.json({ error: "Email is not configured (SMTP_* env vars)" }, { status: 503 });

  const pdf = await buildAttachmentPdf(session.sub, "payslip", payslip.id);
  if (!pdf) return NextResponse.json({ error: "Could not build payslip PDF" }, { status: 500 });

  try {
    await transporter.sendMail({
      from,
      to: payslip.employee.email,
      subject: `Payslip — ${run.yearMonth}`,
      text: `Hi ${payslip.employee.displayName},\n\nPlease find your payslip for ${run.yearMonth} attached.\n\nRegards,`,
      attachments: [{ filename: pdf.filename, content: pdf.buffer }],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send email. Check SMTP settings." }, { status: 500 });
  }

  await writeAuditLog(session.sub, "PAYSLIP_EMAIL_SENT", "Payslip", payslip.id, { runId, employeeId: payslip.employeeId });

  return NextResponse.json({ ok: true });
}
