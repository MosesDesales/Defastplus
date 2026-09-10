import type { WorkTaskPriority, WorkTaskStatus } from "@prisma/client";
import { formatStatusLabel, priorityBadgeClass, statusBadgeClass } from "@/lib/tasks/helpers";

export function TaskStatusBadge({ status }: { status: WorkTaskStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}>
      {formatStatusLabel(status)}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: WorkTaskPriority | string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priorityBadgeClass(priority)}`}>
      {String(priority).toLowerCase()}
    </span>
  );
}
