import { redirect } from "next/navigation";
import { LedgerReportClient } from "@/components/reports/LedgerReportClient";
import { getSession } from "@/lib/session";

export default async function TrialBalanceReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <LedgerReportClient mode="trial-balance" title="Trial Balance" />;
}
