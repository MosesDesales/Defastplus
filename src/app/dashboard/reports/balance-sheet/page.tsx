import { redirect } from "next/navigation";
import { LedgerReportClient } from "@/components/reports/LedgerReportClient";
import { getSession } from "@/lib/session";

export default async function BalanceSheetReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <LedgerReportClient mode="balance-sheet" title="Balance Sheet" />;
}
