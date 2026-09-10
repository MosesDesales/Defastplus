import { redirect } from "next/navigation";
import { TimeTimesheetsClient } from "@/components/time-tracking/TimeTimesheetsClient";
import { getSession } from "@/lib/session";

export default async function TimeTimesheetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeTimesheetsClient />;
}
