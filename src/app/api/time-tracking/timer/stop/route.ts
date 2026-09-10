import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { assertDailyCap, hasOverlap } from "@/lib/time-tracking/invoice-from-entries";
import { runningSegmentSeconds } from "@/lib/time-tracking/timer-helpers";
import { timeTimerStopSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = timeTimerStopSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const entryId = parsed.data.entryId;

  const entry = entryId
    ? await prisma.timeEntry.findFirst({ where: { id: entryId, userId: session.sub, isManual: false } })
    : await prisma.timeEntry.findFirst({ where: { userId: session.sub, isRunning: true, isManual: false } });
  if (!entry) return NextResponse.json({ error: "No timer entry to stop" }, { status: 404 });
  if (entry.endedAt) {
    return NextResponse.json({ error: "Timer already stopped" }, { status: 400 });
  }

  const now = new Date();
  let newDuration = entry.durationSeconds;
  if (entry.isRunning) {
    const seg = runningSegmentSeconds(entry.startedAt, true);
    newDuration = entry.durationSeconds + seg;

    try {
      await assertDailyCap(prisma, session.sub, entry.employeeId, entry.workDate, newDuration, entry.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Daily cap exceeded" }, { status: 400 });
    }

    const intervalStart = entry.startedAt ?? now;
    if (await hasOverlap(prisma, session.sub, entry.employeeId, intervalStart, now, entry.id)) {
      return NextResponse.json({ error: "Stopped interval overlaps another entry." }, { status: 400 });
    }
  } else {
    try {
      await assertDailyCap(prisma, session.sub, entry.employeeId, entry.workDate, newDuration, entry.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Daily cap exceeded" }, { status: 400 });
    }
  }

  await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      durationSeconds: newDuration,
      isRunning: false,
      startedAt: null,
      endedAt: now,
    },
  });

  if (entry.timesheetId) {
    const sum = await prisma.timeEntry.aggregate({
      where: { timesheetId: entry.timesheetId },
      _sum: { durationSeconds: true },
    });
    await prisma.timesheet.update({
      where: { id: entry.timesheetId },
      data: { totalSeconds: sum._sum.durationSeconds ?? 0 },
    });
  }

  return NextResponse.json({
    id: entry.id,
    durationSeconds: newDuration,
    endedAt: now.toISOString(),
  });
}
