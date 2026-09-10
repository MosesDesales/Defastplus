import { NextResponse } from "next/server";
import { buildGeneralLedgerSection } from "@/lib/accounting/general-ledger-query";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function parseDayBoundary(iso: string, endOfDay: boolean): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("bad date");
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAccounts(prisma, session.sub);

  const { searchParams } = new URL(request.url);
  const allRaw = searchParams.get("all");
  const allAccounts = allRaw === "1" || allRaw === "true";
  const accountId = searchParams.get("accountId");
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  if (!fromRaw || !toRaw) {
    return NextResponse.json({ error: "Query params from and to (ISO dates) are required." }, { status: 400 });
  }

  let from: Date;
  let to: Date;
  try {
    from = parseDayBoundary(fromRaw, false);
    to = parseDayBoundary(toRaw, true);
  } catch {
    return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
  }

  if (allAccounts) {
    const accounts = await prisma.account.findMany({
      where: { userId: session.sub },
      orderBy: { code: "asc" },
    });
    const sections = await Promise.all(
      accounts.map((a) => buildGeneralLedgerSection(prisma, session.sub, a, from, to)),
    );
    return NextResponse.json({
      allAccounts: true,
      from: from.toISOString(),
      to: to.toISOString(),
      sections,
    });
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "Query param accountId is required unless all=1." },
      { status: 400 },
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: session.sub },
  });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const section = await buildGeneralLedgerSection(prisma, session.sub, account, from, to);

  return NextResponse.json({
    allAccounts: false,
    from: from.toISOString(),
    to: to.toISOString(),
    account: section.account,
    rows: section.rows,
    closingBalance: section.closingBalance,
  });
}
