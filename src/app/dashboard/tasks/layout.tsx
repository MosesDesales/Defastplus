import type { ReactNode } from "react";
import { TasksSubnav } from "@/components/tasks/TasksSubnav";

export default function TasksLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <TasksSubnav />
      {children}
    </div>
  );
}
