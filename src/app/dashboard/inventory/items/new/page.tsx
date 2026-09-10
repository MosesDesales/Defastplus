import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function NewInventoryItemPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = await prisma.companyProfile.findUnique({
    where: { userId: session.sub },
    select: { gstin: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard/inventory/items"
        className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
      >
        ← Items
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Inventory</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Add item</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Define SKU, units, pricing, and opening quantity for your default warehouse.
      </p>

      <InventoryItemForm companyGstin={company?.gstin ?? null} />
    </div>
  );
}
