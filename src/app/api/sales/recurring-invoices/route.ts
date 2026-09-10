import { Prisma, RecurringInvoiceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { recurringInvoiceCreateSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_invoice");
  if (denied) return denied;

  const rows = await prisma.recurringInvoice.findMany({
    where: { userId: session.sub },
    include: { customer: { select: { displayName: true, email: true } }, lines: true },
    orderBy: { nextRunDate: "asc" },
    take: 300,
  });

  return NextResponse.json({
    recurringInvoices: rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer.displayName,
      profileName: r.profileName,
      frequency: r.frequency,
      repeatEvery: r.repeatEvery,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      nextRunDate: r.nextRunDate.toISOString(),
      status: r.status,
      autoEmail: r.autoEmail,
      lastGeneratedAt: r.lastGeneratedAt?.toISOString() ?? null,
      lineCount: r.lines.length,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "recurring_invoice");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recurringInvoiceCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const startDate = parseYmd(d.startDate);
  if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });

  let endDate: Date | null = null;
  if (d.endDate?.trim()) {
    endDate = parseYmd(d.endDate.trim());
    if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
    if (endDate < startDate) {
      return NextResponse.json({ error: "End date must be on or after start date." }, { status: 400 });
    }
  }

  let nextRunDate = startDate;
  if (d.nextRunDate?.trim()) {
    nextRunDate = parseYmd(d.nextRunDate.trim());
    if (Number.isNaN(nextRunDate.getTime())) {
      return NextResponse.json({ error: "Invalid next run date" }, { status: 400 });
    }
    if (nextRunDate < startDate) {
      return NextResponse.json({ error: "Next run date must be on or after start date." }, { status: 400 });
    }
  }

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, userId: session.sub },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const status =
    d.status === "PAUSED"
      ? RecurringInvoiceStatus.PAUSED
      : d.status === "STOPPED"
        ? RecurringInvoiceStatus.STOPPED
        : RecurringInvoiceStatus.ACTIVE;

  const row = await prisma.recurringInvoice.create({
    data: {
      userId: session.sub,
      customerId: d.customerId,
      profileName: d.profileName?.trim() ?? "",
      frequency: d.frequency,
      repeatEvery: d.repeatEvery,
      startDate,
      endDate,
      nextRunDate,
      status,
      autoEmail: d.autoEmail ?? false,
      lines: {
        create: d.lines.map((l, i) => ({
          itemId: l.itemId ?? null,
          description: l.description.trim(),
          quantity: new Prisma.Decimal(l.quantity),
          rate: new Prisma.Decimal(l.rate),
          sortOrder: i,
        })),
      },
    },
  });

  return NextResponse.json({ recurringInvoice: { id: row.id } }, { status: 201 });
}
