import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerCreateForm } from "@/components/CustomerCreateForm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const existing = await prisma.customer.findMany({
    where: { userId: session.sub },
    select: { displayName: true },
    orderBy: { displayName: "asc" },
  });

  const existingDisplayNames = existing.map((c) => c.displayName);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard/sales/customers"
        className="text-sm font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        ← Customers
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">New customer</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Capture contact details, billing preferences, and portal options — aligned with common accounting suites such as{" "}
        <a
          href="https://www.zoho.com/in/books/"
          className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
          target="_blank"
          rel="noopener noreferrer"
        >
          Zoho Books
        </a>
        .
      </p>

      <CustomerCreateForm existingDisplayNames={existingDisplayNames} />
    </div>
  );
}
