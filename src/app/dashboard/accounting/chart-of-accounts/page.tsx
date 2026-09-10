import { redirect } from "next/navigation";
import { ChartOfAccountsClient } from "@/components/accounting/ChartOfAccountsClient";
import { getSession } from "@/lib/session";

export default async function ChartOfAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ChartOfAccountsClient />;
}
