import Link from "next/link";
import { redirect } from "next/navigation";
import { VendorForm } from "@/components/purchases/VendorForm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export default async function EditVendorPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;

  const existing = await prisma.vendor.findMany({
    where: { userId: session.sub },
    select: { displayName: true },
    orderBy: { displayName: "asc" },
  });

  const existingDisplayNames = existing.map((v) => v.displayName);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard/purchases/vendors"
        className="text-sm font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        ← Vendors
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Purchases</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Edit vendor</h1>

      <VendorForm vendorId={id} existingDisplayNames={existingDisplayNames} />
    </div>
  );
}
