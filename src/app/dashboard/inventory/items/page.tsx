import { redirect } from "next/navigation";
import { InventoryItemsClient } from "@/components/inventory/InventoryItemsClient";
import { getSession } from "@/lib/session";

export default async function InventoryItemsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <InventoryItemsClient />;
}
