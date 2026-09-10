import { NextResponse } from "next/server";
import { generateInvoiceFromRecurringTemplate } from "@/lib/sales/recurring-invoice-generate";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireApiModules } from "@/lib/api-require-module";

type Ctx = { params: Promise<{ id: string }> };

/** Manual run: generates one invoice if due, or with `force: true` in JSON body. */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_invoice");
  if (denied) return denied;
  const { id } = await ctx.params;

  const tmpl = await prisma.recurringInvoice.findFirst({
    where: { id, userId: session.sub },
  });
  if (!tmpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let force = false;
  try {
    const j = await request.json();
    if (j && typeof j === "object" && "force" in j) force = Boolean((j as { force?: unknown }).force);
  } catch {
    /* empty body ok */
  }

  const res = await generateInvoiceFromRecurringTemplate(prisma, id, { force });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, invoiceId: res.invoiceId, invoiceNumber: res.invoiceNumber });
}
