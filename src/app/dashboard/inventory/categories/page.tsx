import { redirect } from "next/navigation";
import { CategoriesManager } from "@/components/inventory/CategoriesManager";
import { getSession } from "@/lib/session";

export default async function InventoryCategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <CategoriesManager />;
}
