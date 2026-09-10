import { Prisma, VendorCreditStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { postVendorCreditJournal } from "@/lib/accounting/purchases-posting";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseYmd } from "@/lib/dates";
import { vendorCreditCreateSchema } from "@/lib/validators";
import { requireApiModules } from "@/lib/api-require-module";

async function nextCreditNumber(userId: string) {
  const n = await prisma.vendorCredit.count({ where: { userId } });
  return `VCR-${String(n + 1).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "vendor_credit");
  if (denied) return denied;

  const vendorId = new URL(request.url).searchParams.get("vendorId") ?? undefined;

  const rows = await prisma.vendorCredit.findMany({
    where: { userId: session.sub, ...(vendorId ? { vendorId } : {}) },
    orderBy: { issueDate: "desc" },
    take: 200,
    include: { vendor: { select: { displayName: true } } },
  });

  return NextResponse.json({
    credits: rows.map((c) => ({
      id: c.id,
      creditNumber: c.creditNumber,
      issueDate: c.issueDate.toISOString(),
      vendorId: c.vendorId,
      vendorName: c.vendor.displayName,
      amount: Number(c.amount),
      amountApplied: Number(c.amountApplied),
      balance: Number(c.amount) - Number(c.amountApplied),
      status: c.status,
      reason: c.reason,
      posted: Boolean(c.journalEntryId),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "vendor_credit");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vendorCreditCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const issueDate = parseYmd(data.issueDate);
  if (Number.isNaN(issueDate.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const vendor = await prisma.vendor.findFirst({
    where: { id: data.vendorId, userId: session.sub },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const expOk = await prisma.account.findFirst({
    where: { id: data.expenseAccountId, userId: session.sub, isActive: true },
  });
  if (!expOk) return NextResponse.json({ error: "Invalid expense account" }, { status: 400 });

  const creditNumber = data.creditNumber?.trim() || (await nextCreditNumber(session.sub));
  const clash = await prisma.vendorCredit.findUnique({
    where: { userId_creditNumber: { userId: session.sub, creditNumber } },
  });
  if (clash) return NextResponse.json({ error: "Credit number in use" }, { status: 409 });

  const credit = await prisma.$transaction(async (tx) => {
    await ensureDefaultAccounts(tx, session.sub);
    const cr = await tx.vendorCredit.create({
      data: {
        userId: session.sub,
        vendorId: data.vendorId,
        creditNumber,
        issueDate,
        amount: new Prisma.Decimal(data.amount),
        reason: data.reason?.trim() ?? null,
        expenseAccountId: data.expenseAccountId,
        status: VendorCreditStatus.OPEN,
      },
    });
    await postVendorCreditJournal(tx, session.sub, cr.id);
    return cr;
  });

  return NextResponse.json({ credit: { id: credit.id, creditNumber } }, { status: 201 });
}
