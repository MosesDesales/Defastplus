import Link from "next/link";
import { redirect } from "next/navigation";
import { PurchaseReturnsListClient } from "@/components/purchases/PurchaseReturnsListClient";
import { getSession } from "@/lib/session";

export default async function PurchaseReturnsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Purchases</p>
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Purchase returns</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Document goods returned to suppliers. Generate E-Way Bills for movement back to the vendor.
          </p>
        </div>
        <Link
          href="/dashboard/purchases/purchase-returns/new"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          + New return
        </Link>
      </div>
      <PurchaseReturnsListClient />
    </div>
  );
}
