import { redirect } from "next/navigation";
import { EWayBillReportsClient } from "@/components/gst/EWayBillReportsClient";
import { getSession } from "@/lib/session";

export default async function EWayBillReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <EWayBillReportsClient />;
}
