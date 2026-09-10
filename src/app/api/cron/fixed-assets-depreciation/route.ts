import { NextResponse } from "next/server";
import { runDepreciation } from "@/lib/fixed-assets/service";
import { prisma } from "@/lib/prisma";

/** Monthly cron: post due depreciation for all tenants. Authorization: Bearer $CRON_SECRET */
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

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const asOf = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0, 0));

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let totalPosted = 0;
  let totalWould = 0;
  const errors: string[] = [];

  for (const u of users) {
    try {
      const r = await runDepreciation(prisma, u.id, { asOf, dryRun: false });
      totalPosted += r.posted;
      totalWould += r.wouldPost;
      for (const e of r.errors) errors.push(`${u.id}: ${e}`);
    } catch (e) {
      errors.push(`${u.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    asOf: asOf.toISOString(),
    usersProcessed: users.length,
    posted: totalPosted,
    errors,
  });
}
