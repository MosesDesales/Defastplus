import { NextResponse } from "next/server";
import { runRecurringPurchases } from "@/lib/purchases/recurring-run";
import { prisma } from "@/lib/prisma";

/** Call from external cron (e.g. daily) with header Authorization: Bearer $CRON_SECRET */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (secret) {
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Set CRON_SECRET to enable this endpoint in production." }, { status: 503 });
  }

  const result = await runRecurringPurchases(prisma);
  return NextResponse.json({
    ok: true,
    expensesCreated: result.expensesCreated,
    billsCreated: result.billsCreated,
  });
}
