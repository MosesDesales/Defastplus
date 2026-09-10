import Link from "next/link";
import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/purchases/ExpenseForm";
import { getSession } from "@/lib/session";

export default async function NewExpensePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-2 sm:px-6">
      <Link
        href="/dashboard/purchases/expenses"
        className="text-sm font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        ← Expenses
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Purchases</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Record expense</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Upload a PDF or receipt image (OCR) to extract merchant, dates, totals, and tax — preview and edit before saving. Always verify
        accounts and amounts.
      </p>
      <ExpenseForm />
    </div>
  );
}
