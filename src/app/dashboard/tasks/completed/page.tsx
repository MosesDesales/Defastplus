import { TasksListClient } from "@/components/tasks/TasksListClient";

export default function CompletedTasksPage() {
  return (
    <TasksListClient
      title="Completed tasks"
      description="Finished work items."
      defaultQuery={{ completed: "1" }}
      showCreate={false}
    />
  );
}
