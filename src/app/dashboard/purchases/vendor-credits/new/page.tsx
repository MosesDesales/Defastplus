import { redirect } from "next/navigation";
import { VendorCreditForm } from "@/components/purchases/VendorCreditForm";
import { getSession } from "@/lib/session";

export default async function NewVendorCreditPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="pt-2">
      <p className="mx-auto max-w-lg px-4 text-xs font-semibold uppercase text-teal-600 dark:text-teal-400 sm:px-6">Purchases</p>
      <h1 className="mx-auto max-w-lg px-4 text-2xl font-semibold text-slate-900 dark:text-white sm:px-6">New vendor credit</h1>
      <VendorCreditForm />
    </div>
  );
}
