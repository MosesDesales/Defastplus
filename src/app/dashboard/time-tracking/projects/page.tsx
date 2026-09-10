import { redirect } from "next/navigation";
import { TimeProjectsClient } from "@/components/time-tracking/TimeProjectsClient";
import { getSession } from "@/lib/session";

export default async function TimeProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeProjectsClient />;
}
