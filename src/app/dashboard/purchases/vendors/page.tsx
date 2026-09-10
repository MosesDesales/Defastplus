import { redirect } from "next/navigation";
import { VendorsListClient } from "@/components/purchases/VendorsListClient";
import { getSession } from "@/lib/session";

export default async function VendorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <VendorsListClient />;
}
