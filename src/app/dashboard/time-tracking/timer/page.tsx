import { redirect } from "next/navigation";
import { TimeTimerClient } from "@/components/time-tracking/TimeTimerClient";
import { getSession } from "@/lib/session";

export default async function TimeTimerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeTimerClient />;
}
