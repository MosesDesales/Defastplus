import { redirect } from "next/navigation";
import { GeneralSettingsClient } from "@/components/settings/GeneralSettingsClient";
import { getSession } from "@/lib/session";

export default async function GeneralModuleSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <GeneralSettingsClient />;
}
