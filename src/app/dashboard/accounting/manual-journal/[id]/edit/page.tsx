import { redirect } from "next/navigation";
import { ManualJournalForm } from "@/components/accounting/ManualJournalForm";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function EditManualJournalPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;

  return (
    <div className="pt-2">
      <p className="mx-auto max-w-5xl px-4 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 sm:px-6">
        Accounting
      </p>
      <h1 className="mx-auto max-w-5xl px-4 text-2xl font-semibold text-slate-900 dark:text-white sm:px-6">Journal</h1>
      <p className="mx-auto max-w-5xl px-4 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Drafts are editable; posted journals are read only.
      </p>
      <ManualJournalForm journalId={id} />
    </div>
  );
}
