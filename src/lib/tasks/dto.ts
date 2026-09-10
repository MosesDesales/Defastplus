import type { Prisma } from "@prisma/client";
import { isWorkTaskOverdue } from "@/lib/tasks/helpers";

export type WorkTaskWithRelations = Prisma.WorkTaskGetPayload<{
  include: {
    assignedEmployee: { select: { id: true; displayName: true } };
    timeProject: { select: { id: true; name: true } };
    customer: { select: { id: true; displayName: true } };
    vendor: { select: { id: true; displayName: true } };
    subtasks: true;
  };
}>;

export function workTaskToDto(task: WorkTaskWithRelations) {
  const overdue = isWorkTaskOverdue(task);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    assignedEmployeeId: task.assignedEmployeeId,
    assigneeName: task.assignedEmployee?.displayName ?? null,
    timeProjectId: task.timeProjectId,
    projectName: task.timeProject?.name ?? null,
    customerId: task.customerId,
    customerName: task.customer?.displayName ?? null,
    vendorId: task.vendorId,
    vendorName: task.vendor?.displayName ?? null,
    priority: task.priority,
    status: task.status,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    estimatedHours: task.estimatedHours != null ? Number(task.estimatedHours) : null,
    actualSeconds: task.actualSeconds,
    progressPercent: task.progressPercent,
    billable: task.billable,
    tags: task.tags ? task.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    recurrenceRule: task.recurrenceRule,
    completedAt: task.completedAt?.toISOString() ?? null,
    overdue,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    subtaskCount: task.subtasks?.length ?? 0,
  };
}

export const workTaskListInclude = {
  assignedEmployee: { select: { id: true, displayName: true } },
  timeProject: { select: { id: true, name: true } },
  customer: { select: { id: true, displayName: true } },
  vendor: { select: { id: true, displayName: true } },
  subtasks: true,
} satisfies Prisma.WorkTaskInclude;
