import { redirect } from "next/navigation";
import { WarehousesManager } from "@/components/inventory/WarehousesManager";
import { getSession } from "@/lib/session";

export default async function InventoryWarehousesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <WarehousesManager />;
}
