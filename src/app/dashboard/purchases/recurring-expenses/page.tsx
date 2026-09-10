import { redirect } from "next/navigation";
import { RecurringExpensesClient } from "@/components/purchases/RecurringExpensesClient";
import { getSession } from "@/lib/session";

export default async function RecurringExpensesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <RecurringExpensesClient />;
}
