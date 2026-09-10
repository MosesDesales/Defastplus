import { redirect } from "next/navigation";
import { RecurringBillsClient } from "@/components/purchases/RecurringBillsClient";
import { getSession } from "@/lib/session";

export default async function RecurringBillsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <RecurringBillsClient />;
}
