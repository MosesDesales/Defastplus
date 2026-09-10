import { redirect } from "next/navigation";
import { EWayBillSettingsClient } from "@/components/gst/EWayBillSettingsClient";
import { getSession } from "@/lib/session";

export default async function EWayBillSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <EWayBillSettingsClient />;
}
