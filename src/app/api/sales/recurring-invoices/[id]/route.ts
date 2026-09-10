import { RecurringInvoiceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { recurringInvoicePatchSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_invoice");
  if (denied) return denied;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recurringInvoicePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const status =
    parsed.data.status === "PAUSED"
      ? RecurringInvoiceStatus.PAUSED
      : parsed.data.status === "STOPPED"
        ? RecurringInvoiceStatus.STOPPED
        : RecurringInvoiceStatus.ACTIVE;

  const row = await prisma.recurringInvoice.updateMany({
    where: { id, userId: session.sub },
    data: { status },
  });
  if (row.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
