import { NextResponse } from "next/server";
import { parseReportDate, trialBalanceReport } from "@/lib/accounting/report-queries";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const from = parseReportDate(searchParams.get("from"), startOfMonth);
  const to = parseReportDate(searchParams.get("to"), endOfMonth);

  const data = await trialBalanceReport(session.sub, from, to);
  return NextResponse.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    ...data,
    balanced: Math.abs(data.totalDebit - data.totalCredit) < 0.02,
  });
}
