import { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { suggestAccountCode } from "@/lib/accounting/account-code";
import { ensureDefaultAccounts } from "@/lib/accounting/default-accounts";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { accountCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAccounts(prisma, session.sub);

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type") as AccountType | null;
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();

  const accounts = await prisma.account.findMany({
    where: {
      userId: session.sub,
      ...(typeFilter && Object.values(AccountType).includes(typeFilter) ? { type: typeFilter } : {}),
    },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    include: {
      _count: { select: { journalLines: true, children: true } },
    },
  });

  let rows = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    parentId: a.parentId,
    openingBalance: Number(a.openingBalance),
    description: a.description,
    isActive: a.isActive,
    isSystem: a.isSystem,
    transactionCount: a._count.journalLines,
    childCount: a._count.children,
    updatedAt: a.updatedAt.toISOString(),
  }));

  if (search) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(search) || r.code.toLowerCase().includes(search));
  }

  return NextResponse.json({ accounts: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = accountCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  let code = data.code?.trim() ? data.code.trim() : null;
  if (data.autoCode || !code) {
    code = await suggestAccountCode(session.sub, data.type);
  }

  const clash = await prisma.account.findFirst({
    where: { userId: session.sub, code },
  });
  if (clash) {
    return NextResponse.json({ error: "Account code already exists." }, { status: 409 });
  }

  let parentId: string | null = data.parentId ?? null;
  if (parentId) {
    const parent = await prisma.account.findFirst({
      where: { id: parentId, userId: session.sub },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent account not found." }, { status: 400 });
    }
    if (parent.type !== data.type) {
      return NextResponse.json({ error: "Parent account must have the same account type." }, { status: 400 });
    }
  }

  const openingBalance = data.openingBalance ?? 0;
  const isActive = data.isActive ?? true;

  const account = await prisma.account.create({
    data: {
      userId: session.sub,
      code,
      name: data.name.trim(),
      type: data.type,
      parentId,
      openingBalance,
      description: data.description?.trim() ?? null,
      isActive,
      isSystem: false,
    },
  });

  return NextResponse.json(
    {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
    },
    { status: 201 },
  );
}
