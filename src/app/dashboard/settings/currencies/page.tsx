import { redirect } from "next/navigation";
import { CurrenciesSettingsClient } from "@/components/settings/CurrenciesSettingsClient";
import { getSession } from "@/lib/session";

export default async function CurrenciesSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <CurrenciesSettingsClient />;
}
