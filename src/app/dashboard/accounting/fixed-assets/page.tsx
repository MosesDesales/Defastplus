import { redirect } from "next/navigation";
import { FixedAssetsClient } from "@/components/accounting/FixedAssetsClient";
import { getSession } from "@/lib/session";

export default async function FixedAssetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <FixedAssetsClient />;
}
