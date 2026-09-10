import { redirect } from "next/navigation";
import { ValuationReport } from "@/components/inventory/ValuationReport";
import { getSession } from "@/lib/session";

export default async function InventoryValuationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ValuationReport />;
}
