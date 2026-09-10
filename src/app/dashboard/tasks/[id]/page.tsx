import { TaskDetailClient } from "@/components/tasks/TaskDetailClient";

type Props = { params: Promise<{ id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  return <TaskDetailClient taskId={id} />;
}
