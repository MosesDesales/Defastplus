import { redirect } from "next/navigation";
import { ExpensesListClient } from "@/components/purchases/ExpensesListClient";
import { getSession } from "@/lib/session";

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ExpensesListClient />;
}
