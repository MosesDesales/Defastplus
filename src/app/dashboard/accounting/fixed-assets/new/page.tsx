import { redirect } from "next/navigation";
import { FixedAssetFormClient } from "@/components/accounting/FixedAssetFormClient";
import { getSession } from "@/lib/session";

export default async function NewFixedAssetPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <FixedAssetFormClient />;
}
