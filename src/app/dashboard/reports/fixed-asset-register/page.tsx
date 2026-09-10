import { redirect } from "next/navigation";
import { FixedAssetRegisterReportClient } from "@/components/reports/FixedAssetRegisterReportClient";
import { getSession } from "@/lib/session";

export default async function FixedAssetRegisterReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <FixedAssetRegisterReportClient />;
}
