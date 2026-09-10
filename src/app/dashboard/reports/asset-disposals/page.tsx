import { redirect } from "next/navigation";
import { AssetDisposalReportClient } from "@/components/reports/AssetDisposalReportClient";
import { getSession } from "@/lib/session";

export default async function AssetDisposalsReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AssetDisposalReportClient />;
}
