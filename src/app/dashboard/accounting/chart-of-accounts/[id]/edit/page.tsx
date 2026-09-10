import { redirect } from "next/navigation";
import { AccountForm } from "@/components/accounting/AccountForm";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function EditAccountPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;

  return (
    <div className="pt-2">
      <p className="mx-auto max-w-3xl px-4 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 sm:px-6">
        Accounting
      </p>
      <h1 className="mx-auto max-w-3xl px-4 text-2xl font-semibold text-slate-900 dark:text-white sm:px-6">Edit account</h1>
      <p className="mx-auto max-w-3xl px-4 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Update name, code, parent, and status. System accounts have limited edits.
      </p>
      <AccountForm accountId={id} />
    </div>
  );
}
