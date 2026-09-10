import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiModules } from "@/lib/api-require-module";
import { workTaskListInclude, workTaskToDto } from "@/lib/tasks/dto";
import { syncTimeProjectProgressFromWorkTasks } from "@/lib/tasks/helpers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { workTaskStatusPatchSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireApiModules(session.sub, "tasks");
  if (denied) return denied;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = workTaskStatusPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workTask.findFirst({ where: { id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = await prisma.workTask.update({
    where: { id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
      progressPercent: parsed.data.status === "COMPLETED" ? 100 : existing.progressPercent,
    },
    include: workTaskListInclude,
  });

  if (row.timeProjectId) {
    await syncTimeProjectProgressFromWorkTasks(prisma, row.timeProjectId, session.sub);
  }
  await writeAuditLog(session.sub, "status", "work_task", id, { status: parsed.data.status });

  return NextResponse.json({ task: workTaskToDto(row) });
}
