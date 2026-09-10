import { redirect } from "next/navigation";
import { UnitsManager } from "@/components/inventory/UnitsManager";
import { getSession } from "@/lib/session";

export default async function InventoryUnitsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <UnitsManager />;
}
