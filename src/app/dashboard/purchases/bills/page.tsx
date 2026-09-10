import { redirect } from "next/navigation";
import { BillsListClient } from "@/components/purchases/BillsListClient";
import { getSession } from "@/lib/session";

export default async function BillsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <BillsListClient />;
}
