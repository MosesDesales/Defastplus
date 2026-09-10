import { redirect } from "next/navigation";
import { PurchasesHomeClient } from "@/components/purchases/PurchasesHomeClient";
import { getSession } from "@/lib/session";

export default async function PurchasesOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <PurchasesHomeClient />;
}
