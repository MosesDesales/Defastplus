import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRoundSearch } from "lucide-react";
import { IntegrationWorkspace } from "@/components/integrations/IntegrationWorkspace";
import { getSession } from "@/lib/session";

export default async function QuickBooksIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
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
      <IntegrationWorkspace
        slug="quickbooks"
        variant="quickbooks"
        title="QuickBooks Integration"
        subtitle="Intuit OAuth placeholders — sync customers, invoices, expenses, and payments once OAuth and realm are connected."
      />
    </div>
  );
}
