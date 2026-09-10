import Link from "next/link";
import { redirect } from "next/navigation";
import { RecurringInvoiceForm } from "@/components/sales/RecurringInvoiceForm";
import { getSession } from "@/lib/session";

export default async function NewRecurringInvoicePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/sales/recurring-invoices" className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400">
        ← Recurring invoices
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Sales</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">New recurring invoice</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Each run creates a normal <strong>SENT</strong> invoice (Dr AR, Cr Sales, Cr GST) linked to this template.
      </p>
      <RecurringInvoiceForm />
    </div>
  );
}
