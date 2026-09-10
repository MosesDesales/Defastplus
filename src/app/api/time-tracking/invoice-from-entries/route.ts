import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { createInvoiceFromTimeEntries } from "@/lib/time-tracking/invoice-from-entries";
import { timeInvoiceFromEntriesSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  if (!hasPermission(session.permissions, "sales.create") && !hasPermission(session.permissions, "sales.*")) {
    return NextResponse.json({ error: "Missing permission to create invoices" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeInvoiceFromEntriesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const res = await createInvoiceFromTimeEntries(prisma, session.sub, d.entryIds, {
    taxPercent: d.taxPercent,
    issueDate: d.issueDate,
    dueDate: d.dueDate ?? undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({
    invoiceId: res.invoiceId,
    invoiceNumber: res.invoiceNumber,
  });
}
