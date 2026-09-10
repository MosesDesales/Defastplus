import { redirect } from "next/navigation";
import { OrganizationProfileClient } from "@/components/settings/OrganizationProfileClient";
import { ProfileSettingsAnchorScroll } from "@/components/settings/ProfileSettingsAnchorScroll";
import { getSession } from "@/lib/session";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-w-0">
      <ProfileSettingsAnchorScroll />
      <OrganizationProfileClient />
    </div>
  );
}
