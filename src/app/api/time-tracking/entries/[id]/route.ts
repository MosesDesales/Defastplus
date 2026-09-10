import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiModules } from "@/lib/api-require-module";
import { getSession } from "@/lib/session";
import { assertDailyCap } from "@/lib/time-tracking/invoice-from-entries";
import { liveDurationSeconds } from "@/lib/time-tracking/timer-helpers";
import { timeEntryPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function refreshTimesheetTotal(timesheetId: string | null) {
  if (!timesheetId) return;
  const sum = await prisma.timeEntry.aggregate({
    where: { timesheetId },
    _sum: { durationSeconds: true },
  });
  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { totalSeconds: sum._sum.durationSeconds ?? 0 },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.timeEntry.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.invoiceId) {
    return NextResponse.json({ error: "Invoiced entries cannot be edited" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = timeEntryPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const oldTs = existing.timesheetId;
  let newTs = d.timesheetId !== undefined ? d.timesheetId?.trim() || null : undefined;

  if (newTs !== undefined && newTs) {
    const ts = await prisma.timesheet.findFirst({
      where: { id: newTs, userId: session.sub, employeeId: existing.employeeId },
    });
    if (!ts) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    if (ts.status !== "DRAFT" && ts.status !== "REJECTED") {
      return NextResponse.json({ error: "Timesheet is not editable" }, { status: 400 });
    }
  }

  if (d.projectId !== undefined && d.projectId) {
    const p = await prisma.timeProject.findFirst({ where: { id: d.projectId, userId: session.sub } });
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (d.taskId !== undefined && d.taskId) {
    const t = await prisma.timeTask.findFirst({ where: { id: d.taskId, project: { userId: session.sub } } });
    if (!t) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let durationSeconds = existing.durationSeconds;
  if (d.durationSeconds != null) {
    if (existing.isRunning) {
      return NextResponse.json({ error: "Stop the timer before changing duration" }, { status: 400 });
    }
    durationSeconds = d.durationSeconds;
  }

  const data: Prisma.TimeEntryUpdateInput = {};
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null;
  if (d.billable != null) data.billable = d.billable;
  if (d.projectId !== undefined) {
    data.project = d.projectId?.trim() ? { connect: { id: d.projectId.trim() } } : { disconnect: true };
  }
  if (d.taskId !== undefined) {
    data.task = d.taskId?.trim() ? { connect: { id: d.taskId.trim() } } : { disconnect: true };
  }
  if (newTs !== undefined) {
    data.timesheet = newTs ? { connect: { id: newTs } } : { disconnect: true };
  }
  if (d.durationSeconds != null) data.durationSeconds = durationSeconds;

  if (d.durationSeconds != null && !existing.isRunning) {
    try {
      await assertDailyCap(prisma, session.sub, existing.employeeId, existing.workDate, durationSeconds, existing.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Daily cap exceeded" }, { status: 400 });
    }
  }

  await prisma.timeEntry.update({ where: { id }, data });
  const nextTs = newTs !== undefined ? newTs : oldTs;
  if (newTs !== undefined && oldTs !== nextTs) {
    await refreshTimesheetTotal(oldTs);
    await refreshTimesheetTotal(nextTs);
  } else if (d.durationSeconds != null && oldTs) {
    await refreshTimesheetTotal(oldTs);
  }

  const updated = await prisma.timeEntry.findFirst({ where: { id, userId: session.sub } });
  return NextResponse.json({ entry: updated ? { ...updated, liveDurationSeconds: liveDurationSeconds(updated) } : null });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "time_tracking");
  if (denied) return denied;
  const { id } = await ctx.params;

  const existing = await prisma.timeEntry.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.invoiceId) {
    return NextResponse.json({ error: "Invoiced entries cannot be deleted" }, { status: 400 });
  }
  if (existing.isRunning) {
    return NextResponse.json({ error: "Stop the timer before deleting" }, { status: 400 });
  }

  await prisma.timeEntry.delete({ where: { id } });
  await refreshTimesheetTotal(existing.timesheetId);
  return NextResponse.json({ ok: true });
}
