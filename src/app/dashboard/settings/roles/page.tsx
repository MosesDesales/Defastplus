import { redirect } from "next/navigation";
import { RolesSettingsClient } from "@/components/settings/RolesSettingsClient";
import { getSession } from "@/lib/session";

export default async function RolesSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Roles & permissions</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Example roles are seeded on signup. JWT carries permission keys — middleware enforces route access.
        </p>
      </div>
      <RolesSettingsClient />
    </div>
  );
}
