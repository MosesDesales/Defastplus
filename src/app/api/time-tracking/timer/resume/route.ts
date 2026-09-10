import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { hasOverlap } from "@/lib/time-tracking/invoice-from-entries";
import { timeTimerResumeSchema } from "@/lib/validators";

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeTimerResumeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      userId: session.sub,
      isRunning: false,
      isManual: false,
      endedAt: null,
    },
  });
  if (!entry) {
    return NextResponse.json({ error: "No paused timer found for this entry" }, { status: 404 });
  }

  const otherRunning = await prisma.timeEntry.findFirst({
    where: { userId: session.sub, isRunning: true },
  });
  if (otherRunning) {
    return NextResponse.json(
      { error: "Another timer is already running.", entryId: otherRunning.id },
      { status: 409 },
    );
  }

  const now = new Date();
  if (await hasOverlap(prisma, session.sub, entry.employeeId, now, new Date(now.getTime() + 1000))) {
    return NextResponse.json({ error: "Another logged interval is active at this time." }, { status: 400 });
  }

  await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { isRunning: true, startedAt: now },
  });

  return NextResponse.json({ id: entry.id, startedAt: now.toISOString() });
}
