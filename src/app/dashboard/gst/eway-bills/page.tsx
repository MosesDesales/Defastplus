import { redirect } from "next/navigation";
import { EWayBillDashboardClient } from "@/components/gst/EWayBillDashboardClient";
import { getSession } from "@/lib/session";

export default async function EWayBillsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <EWayBillDashboardClient />;
}
