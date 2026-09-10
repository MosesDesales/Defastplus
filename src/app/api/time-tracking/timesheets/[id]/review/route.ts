import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { canApproveTimesheets } from "@/lib/time-tracking/rbac";
import { timesheetReviewSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  if (!canApproveTimesheets(session.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const t = await prisma.timesheet.findFirst({ where: { id, userId: session.sub } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only submitted timesheets can be reviewed" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timesheetReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const now = new Date();
  if (d.approved) {
    await prisma.timesheet.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: now,
        reviewerUserId: session.sub,
        reviewNotes: d.reviewNotes?.trim() || null,
        payrollSyncedAt: now,
      },
    });
  } else {
    await prisma.timesheet.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: now,
        reviewerUserId: session.sub,
        reviewNotes: d.reviewNotes?.trim() || null,
      },
    });
  }

  return NextResponse.json({ ok: true, status: d.approved ? "APPROVED" : "REJECTED" });
}
