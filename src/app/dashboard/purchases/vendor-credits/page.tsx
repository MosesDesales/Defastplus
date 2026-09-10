import { redirect } from "next/navigation";
import { VendorCreditsListClient } from "@/components/purchases/VendorCreditsListClient";
import { getSession } from "@/lib/session";

export default async function VendorCreditsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <VendorCreditsListClient />;
}
