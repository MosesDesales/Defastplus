import { redirect } from "next/navigation";
import { SalesHomeClient } from "@/components/sales/SalesHomeClient";
import { getSession } from "@/lib/session";

export default async function SalesOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <SalesHomeClient />;
}
