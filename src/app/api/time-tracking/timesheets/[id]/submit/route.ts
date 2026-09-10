import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;

  const t = await prisma.timesheet.findFirst({ where: { id, userId: session.sub } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.status !== "DRAFT" && t.status !== "REJECTED") {
    return NextResponse.json({ error: "Only draft or rejected timesheets can be submitted" }, { status: 400 });
  }

  const sum = await prisma.timeEntry.aggregate({
    where: { timesheetId: id },
    _sum: { durationSeconds: true },
  });

  await prisma.timesheet.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      totalSeconds: sum._sum.durationSeconds ?? 0,
      reviewNotes: null,
    },
  });

  return NextResponse.json({ ok: true, status: "SUBMITTED" });
}
