import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTableShell } from "@/components/DataTableShell";
import { PageToolbar } from "@/components/PageToolbar";
import { TableRowActions } from "@/components/TableRowActions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const searchInputClass =
  "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rows = await prisma.customer.findMany({
    where: { userId: session.sub },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      customerType: true,
      displayName: true,
      companyName: true,
      email: true,
      workPhoneCountryCode: true,
      workPhone: true,
      mobileCountryCode: true,
      mobile: true,
      currency: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
      <PageToolbar
        title="Customers"
        subtitle="Bill-to contacts, payment terms, and portal access."
        newButton={{ href: "/dashboard/sales/customers/new", label: "+ New customer" }}
      />

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-slate-600 dark:text-slate-400">No customers yet.</p>
          <Link
            href="/dashboard/sales/customers/new"
            className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            Create your first customer
          </Link>
        </div>
      ) : (
        <DataTableShell
          totalRows={rows.length}
          filterSlot={
            <input
              type="search"
              placeholder="Search customers…"
              className={searchInputClass}
              disabled
              title="Server-side search coming soon"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Display name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((c) => {
                  const phone =
                    [c.workPhoneCountryCode, c.workPhone].filter(Boolean).join(" ") ||
                    [c.mobileCountryCode, c.mobile].filter(Boolean).join(" ") ||
                    "—";
                  return (
                    <tr key={c.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.displayName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {c.customerType === "BUSINESS" ? "Business" : "Individual"}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-400" title={c.companyName ?? undefined}>
                        {c.companyName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.email ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">{phone}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.currency}</td>
                      <td className="px-4 py-3 text-right">
                        <TableRowActions
                          actions={[
                            { label: "View", href: `/dashboard/sales/customers/${c.id}` },
                            { label: "Edit", href: `/dashboard/sales/customers/${c.id}` },
                            { label: "Delete", destructive: true, disabled: true },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      )}
    </div>
  );
}
