import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { requireApiModules } from "@/lib/api-require-module";

export async function GET() {
  const session = await requireApiPermission("payroll.view");
  if (session instanceof NextResponse) return session;
  const denied = await requireApiModules(session.sub, "payroll");
  if (denied) return denied;

  const runs = await prisma.payrollRun.findMany({
    where: { userId: session.sub },
    orderBy: { yearMonth: "desc" },
    take: 24,
    include: {
      _count: { select: { payslips: true } },
    },
  });

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      yearMonth: r.yearMonth,
      status: r.status,
      payslipCount: r._count.payslips,
      journalPosted: Boolean(r.journalEntryId),
    })),
  });
}
