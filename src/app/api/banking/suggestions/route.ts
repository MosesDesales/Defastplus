import { NextResponse } from "next/server";
import { suggestBankingMatches } from "@/lib/banking/suggest-matches";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tid = new URL(request.url).searchParams.get("transactionId")?.trim();
  if (!tid) return NextResponse.json({ error: "transactionId required" }, { status: 400 });

  const suggestions = await suggestBankingMatches(prisma, session.sub, tid);
  return NextResponse.json({ suggestions });
}
