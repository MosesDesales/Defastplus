import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function CustomerDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, userId: session.sub },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/sales/customers" className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400">
        ← Customers
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{customer.displayName}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{customer.email ?? "No email"}</p>
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Full profile edit, statements, and linked transactions coming next.
      </p>
    </div>
  );
}
