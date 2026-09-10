import { NextResponse } from "next/server";
import { runRecurringInvoices } from "@/lib/sales/recurring-invoice-run";
import { prisma } from "@/lib/prisma";

/** Daily cron: generate due recurring invoices. Authorization: Bearer $CRON_SECRET */
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

  const result = await runRecurringInvoices(prisma);
  return NextResponse.json({
    ok: true,
    invoicesCreated: result.invoicesCreated,
  });
}
