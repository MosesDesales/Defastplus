import { TasksListClient } from "@/components/tasks/TasksListClient";

export default function MyTasksPage() {
  return (
    <TasksListClient
      title="My tasks"
      description="Tasks assigned to you."
      defaultQuery={{ assignee: "mine" }}
    />
  );
}
