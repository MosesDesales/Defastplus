import Link from "next/link";
import { redirect } from "next/navigation";
import { RecurringExpenseForm } from "@/components/purchases/RecurringExpenseForm";
import { getSession } from "@/lib/session";

export default async function EditRecurringExpensePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-2 sm:px-6">
      <Link
        href="/dashboard/purchases/recurring-expenses"
        className="text-sm font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        ← Recurring expenses
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Purchases</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Edit recurring expense</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Update schedule, amounts, and linked vendor or customer. Generated expenses keep whatever was posted at run time.
      </p>
      <RecurringExpenseForm recurringId={id} />
    </div>
  );
}
