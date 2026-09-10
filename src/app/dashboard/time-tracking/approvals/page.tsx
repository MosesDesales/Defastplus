import { redirect } from "next/navigation";
import { TimeApprovalsClient } from "@/components/time-tracking/TimeApprovalsClient";
import { getSession } from "@/lib/session";

export default async function TimeApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TimeApprovalsClient />;
}
