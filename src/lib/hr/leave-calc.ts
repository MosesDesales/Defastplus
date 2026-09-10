import { prisma } from "@/lib/prisma";

export type LeaveSummaryLine = {
  name: string;
  alloted: number;
  availed: number;
  takenYtd: number;
  balance: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Days paid + per-leave-type Alloted/Availed(this month)/Taken YTD/Balance for one employee's payroll month. */
export async function computeLeaveSummary(
  userId: string,
  employeeId: string,
  yearMonth: string,
): Promise<{ daysPaid: number; lines: LeaveSummaryLine[] }> {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);

  const leaveTypes = await prisma.leaveType.findMany({
    where: { userId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const entries = await prisma.leaveEntry.findMany({
    where: { userId, employeeId, date: { gte: yearStart, lt: monthEnd } },
  });

  let lopDaysThisMonth = 0;
  const lines: LeaveSummaryLine[] = leaveTypes.map((lt) => {
    const forType = entries.filter((e) => e.leaveTypeId === lt.id);
    const availed = round2(
      forType.filter((e) => e.date >= monthStart && e.date < monthEnd).reduce((s, e) => s + Number(e.days), 0),
    );
    const takenYtd = round2(forType.reduce((s, e) => s + Number(e.days), 0));
    const alloted = Number(lt.annualDays);

    if (lt.isLossOfPay) lopDaysThisMonth += availed;

    return { name: lt.name, alloted, availed, takenYtd, balance: round2(alloted - takenYtd) };
  });

  const daysPaid = round2(Math.max(0, daysInMonth - lopDaysThisMonth));

  return { daysPaid, lines };
}
