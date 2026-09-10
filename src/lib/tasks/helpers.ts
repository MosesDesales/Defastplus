import type { PrismaClient, WorkSubtask, WorkSubtaskStatus, WorkTask, WorkTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const WORK_TASK_STATUSES: WorkTaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_REVIEW",
  "COMPLETED",
  "CANCELLED",
];

export function isWorkTaskOverdue(task: { dueDate: Date | null; status: WorkTaskStatus }): boolean {
  if (!task.dueDate) return false;
  if (task.status === "COMPLETED" || task.status === "CANCELLED") return false;
  const end = new Date(task.dueDate);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

export function progressFromSubtasks(subtasks: Pick<WorkSubtask, "status">[]): number {
  if (!subtasks.length) return 0;
  const done = subtasks.filter((s) => s.status === "COMPLETED").length;
  return Math.round((done / subtasks.length) * 100);
}

export async function recalcWorkTaskProgress(
  db: PrismaClient,
  taskId: string,
  userId: string,
): Promise<{ progressPercent: number; status?: WorkTaskStatus }> {
  const subs = await db.workSubtask.findMany({ where: { taskId }, select: { status: true } });
  const progressPercent = progressFromSubtasks(subs);
  const allDone = subs.length > 0 && subs.every((s) => s.status === "COMPLETED");
  const data: { progressPercent: number; status?: WorkTaskStatus; completedAt?: Date | null } = {
    progressPercent,
  };
  if (allDone) {
    data.status = "COMPLETED";
    data.completedAt = new Date();
  }
  const updated = await db.workTask.update({
    where: { id: taskId, userId },
    data,
  });
  if (updated.timeProjectId) {
    await syncTimeProjectProgressFromWorkTasks(db, updated.timeProjectId, userId);
  }
  return { progressPercent, status: data.status };
}

export async function syncTimeProjectProgressFromWorkTasks(
  db: PrismaClient,
  timeProjectId: string,
  userId: string,
): Promise<void> {
  const tasks = await db.workTask.findMany({
    where: { timeProjectId, userId },
    select: { status: true },
  });
  if (!tasks.length) return;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const progressPercent = Math.round((done / tasks.length) * 100);
  await db.timeProject.update({
    where: { id: timeProjectId, userId },
    data: { progressPercent },
  });
}

export async function syncWorkTaskActualSeconds(
  db: PrismaClient,
  workTaskId: string,
  userId: string,
): Promise<void> {
  const sum = await db.timeEntry.aggregate({
    where: { workTaskId, userId },
    _sum: { durationSeconds: true },
  });
  await db.workTask.update({
    where: { id: workTaskId, userId },
    data: { actualSeconds: sum._sum.durationSeconds ?? 0 },
  });
}

export async function resolveEmployeeIdForUser(userId: string, userEmail: string): Promise<string | null> {
  const byEmail = await prisma.employee.findFirst({
    where: { userId, email: userEmail },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;
  const first = await prisma.employee.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export function statusBadgeClass(status: WorkTaskStatus): string {
  switch (status) {
    case "OPEN":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "WAITING_REVIEW":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "CANCELLED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200";
    case "HIGH":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40";
    case "LOW":
      return "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800";
  }
}

export function formatStatusLabel(status: WorkTaskStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
