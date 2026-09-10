import { NextResponse } from "next/server";
import { balanceSheetReport, parseReportDate } from "@/lib/accounting/report-queries";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const asOf = parseReportDate(searchParams.get("asOf"), now);
  const data = await balanceSheetReport(session.sub, asOf);
  return NextResponse.json(data);
}
