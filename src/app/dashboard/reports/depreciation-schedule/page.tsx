import { redirect } from "next/navigation";
import { DepreciationScheduleReportClient } from "@/components/reports/DepreciationScheduleReportClient";
import { getSession } from "@/lib/session";

export default async function DepreciationScheduleReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <DepreciationScheduleReportClient />;
}
