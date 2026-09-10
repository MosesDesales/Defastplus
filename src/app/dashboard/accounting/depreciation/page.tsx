import { redirect } from "next/navigation";
import { DepreciationRunClient } from "@/components/accounting/DepreciationRunClient";
import { getSession } from "@/lib/session";

export default async function DepreciationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <DepreciationRunClient />;
}
