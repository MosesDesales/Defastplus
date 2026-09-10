import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { assertDailyCap } from "@/lib/time-tracking/invoice-from-entries";
import { runningSegmentSeconds } from "@/lib/time-tracking/timer-helpers";
import { timeTimerPauseSchema } from "@/lib/validators";

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
  const parsed = timeTimerPauseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const entry = parsed.data.entryId
    ? await prisma.timeEntry.findFirst({ where: { id: parsed.data.entryId, userId: session.sub, isRunning: true } })
    : await prisma.timeEntry.findFirst({ where: { userId: session.sub, isRunning: true } });
  if (!entry) return NextResponse.json({ error: "No running timer" }, { status: 404 });

  const seg = runningSegmentSeconds(entry.startedAt, entry.isRunning);
  const newDuration = entry.durationSeconds + seg;

  try {
    await assertDailyCap(prisma, session.sub, entry.employeeId, entry.workDate, newDuration, entry.id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Daily cap exceeded" }, { status: 400 });
  }

  await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      durationSeconds: newDuration,
      isRunning: false,
      startedAt: null,
    },
  });

  return NextResponse.json({ id: entry.id, durationSeconds: newDuration, paused: true });
}
