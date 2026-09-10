import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiModules } from "@/lib/api-require-module";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workTaskCommentSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workTaskCommentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const task = await prisma.workTask.findFirst({ where: { id: d.taskId, userId: session.sub } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const row = await prisma.workTaskComment.create({
    data: { taskId: d.taskId, userId: session.sub, body: d.body },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await prisma.workTask.update({ where: { id: d.taskId }, data: { updatedAt: new Date() } });
  await writeAuditLog(session.sub, "comment", "work_task", d.taskId);

  return NextResponse.json(
    {
      comment: {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        user: row.user,
      },
    },
    { status: 201 },
  );
}
