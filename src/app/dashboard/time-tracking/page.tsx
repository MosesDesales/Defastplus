import { redirect } from "next/navigation";
import { TimeDashboardClient } from "@/components/time-tracking/TimeDashboardClient";
import { getSession } from "@/lib/session";

export default async function TimeTrackingDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeDashboardClient />;
}
