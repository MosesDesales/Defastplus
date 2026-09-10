import { redirect } from "next/navigation";
import { PurchaseOrdersListClient } from "@/components/purchases/PurchaseOrdersListClient";
import { getSession } from "@/lib/session";

export default async function PurchaseOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PurchaseOrdersListClient />;
}
