import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";

type P = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: P) {
  const session = await requireApiPermission("payroll.view");
  if (session instanceof NextResponse) return session;
  const { id } = await props.params;

  const run = await prisma.payrollRun.findFirst({ where: { id, userId: session.sub } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.payslip.findMany({
    where: { payrollRunId: id },
    include: { employee: { select: { displayName: true, employeeNumber: true, email: true } } },
    orderBy: { employee: { employeeNumber: "asc" } },
  });

  return NextResponse.json({
    payslips: rows.map((p) => ({
      id: p.id,
      employeeName: p.employee.displayName,
      employeeNumber: p.employee.employeeNumber,
      hasEmail: Boolean(p.employee.email),
      gross: Number(p.gross),
      netPay: Number(p.netPay),
    })),
  });
}
