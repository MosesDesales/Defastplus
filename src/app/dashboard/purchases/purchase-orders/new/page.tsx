import { redirect } from "next/navigation";
import { PurchaseOrderForm } from "@/components/purchases/PurchaseOrderForm";
import { getSession } from "@/lib/session";

export default async function NewPOPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="pt-2">
      <p className="mx-auto max-w-6xl px-4 text-xs font-semibold uppercase text-teal-600 dark:text-teal-400 sm:px-6">Purchases</p>
      <p className="mx-auto max-w-6xl px-4 pb-2 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Create a PO with delivery details, line-level expense accounts, and totals before sending to the vendor.
      </p>
      <PurchaseOrderForm />
    </div>
  );
}
