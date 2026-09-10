import { TasksListClient } from "@/components/tasks/TasksListClient";

export default function AllTasksPage() {
  return (
    <TasksListClient
      title="All tasks"
      description="Full task list with search, filters, and quick actions."
    />
  );
}
