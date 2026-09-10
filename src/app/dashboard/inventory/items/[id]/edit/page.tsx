import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export default async function EditInventoryItemPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await props.params;

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
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Edit item</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Update pricing and metadata. Use stock adjustments to change quantities.
      </p>

      <InventoryItemForm itemId={id} companyGstin={company?.gstin ?? null} />
    </div>
  );
}
