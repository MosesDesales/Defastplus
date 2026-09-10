import { redirect } from "next/navigation";
import { RecurringBillForm } from "@/components/purchases/RecurringBillForm";
import { getSession } from "@/lib/session";

export default async function NewRecurringBillPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="pt-2">
      <p className="mx-auto max-w-6xl px-4 text-xs font-semibold uppercase text-teal-600 dark:text-teal-400 sm:px-6">Purchases</p>
      <p className="mx-auto max-w-6xl px-4 pb-2 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Schedule automatic vendor bills with line items, taxes, and withholding — saved as a reusable template.
      </p>
      <RecurringBillForm />
    </div>
  );
}
