import { NextResponse } from "next/server";
import { requireApiModules } from "@/lib/api-require-module";
import { recalcWorkTaskProgress } from "@/lib/tasks/helpers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workSubtaskCreateSchema, workSubtaskPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id: taskId } = await ctx.params;
  const task = await prisma.workTask.findFirst({ where: { id: taskId, userId: session.sub } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workSubtaskCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.workSubtask.create({
    data: { taskId, title: parsed.data.title, sortOrder: parsed.data.sortOrder },
  });
  await recalcWorkTaskProgress(prisma, taskId, session.sub);

  return NextResponse.json({ subtask: row }, { status: 201 });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id: taskId } = await ctx.params;
  const task = await prisma.workTask.findFirst({ where: { id: taskId, userId: session.sub } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json as { subtaskId?: string };
  if (!body.subtaskId) {
    return NextResponse.json({ error: "subtaskId required" }, { status: 400 });
  }

  const parsed = workSubtaskPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const sub = await prisma.workSubtask.findFirst({ where: { id: body.subtaskId, taskId } });
  if (!sub) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

  const row = await prisma.workSubtask.update({
    where: { id: body.subtaskId },
    data: {
      title: parsed.data.title,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    },
  });
  const progress = await recalcWorkTaskProgress(prisma, taskId, session.sub);

  return NextResponse.json({ subtask: row, progress });
}
