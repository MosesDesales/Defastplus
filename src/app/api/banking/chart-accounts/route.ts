import { NextResponse } from "next/server";
import { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.account.findMany({
    where: { userId: session.sub, isActive: true, type: AccountType.ASSET },
    orderBy: { code: "asc" },
    take: 120,
    select: { id: true, code: true, name: true },
  });

  return NextResponse.json({ accounts: rows });
}
