import { redirect } from "next/navigation";
import { ManualJournalForm } from "@/components/accounting/ManualJournalForm";
import { getSession } from "@/lib/session";

export default async function NewManualJournalPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="pt-2">
      <p className="mx-auto max-w-5xl px-4 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 sm:px-6">
        Accounting
      </p>
      <h1 className="mx-auto max-w-5xl px-4 text-2xl font-semibold text-slate-900 dark:text-white sm:px-6">New journal</h1>
      <p className="mx-auto max-w-5xl px-4 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Debits must equal credits. Save as draft or post to the general ledger.
      </p>
      <ManualJournalForm />
    </div>
  );
}
