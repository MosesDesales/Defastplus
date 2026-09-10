import { redirect } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { IntegrationWorkspace } from "@/components/integrations/IntegrationWorkspace";
import { TallyMigrationClient } from "@/components/integrations/TallyMigrationClient";
import { getSession } from "@/lib/session";

export default async function TallyIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Integrations · Books</p>
        <Link
          href="/dashboard/settings/upcoming?k=find-accountants"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
        >
          <UserRoundSearch className="h-4 w-4" aria-hidden />
          Find accountants
        </Link>
      </div>
      <TallyMigrationClient />
      <IntegrationWorkspace
        slug="tally"
        variant="tally"
        title="Tally bridge settings"
        subtitle="Configure the local TallyPrime HTTP bridge (default port 9000). Test connectivity before running migration from the bridge."
      />
    </div>
  );
}
