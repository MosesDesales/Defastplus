import { redirect } from "next/navigation";
import { TimeTasksClient } from "@/components/time-tracking/TimeTasksClient";
import { getSession } from "@/lib/session";

export default async function TimeTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeTasksClient />;
}
