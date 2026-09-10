import { redirect } from "next/navigation";
import { StockAdjustmentsManager } from "@/components/inventory/StockAdjustmentsManager";
import { getSession } from "@/lib/session";

export default async function StockAdjustmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <StockAdjustmentsManager />;
}
