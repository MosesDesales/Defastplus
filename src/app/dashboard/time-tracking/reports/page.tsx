import { redirect } from "next/navigation";
import { TimeReportsClient } from "@/components/time-tracking/TimeReportsClient";
import { getSession } from "@/lib/session";

export default async function TimeReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeReportsClient />;
}
