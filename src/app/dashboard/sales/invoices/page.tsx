import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTableShell } from "@/components/DataTableShell";
import { PageToolbar } from "@/components/PageToolbar";
import { InvoiceActionsCell } from "@/components/sales/InvoiceActionsCell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const searchClass =
  "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: session.sub },
    orderBy: { issueDate: "desc" },
    include: {
      customer: { select: { displayName: true, email: true } },
      allocations: true,
    },
    take: 300,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
      <PageToolbar
        title="Invoices"
        subtitle="GST/VAT per line, AR posting, payment status — double-entry in the ledger."
        newButton={{ href: "/dashboard/sales/invoices/new", label: "+ New invoice" }}
      />

      {invoices.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 px-8 py-16 text-center dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400">No invoices yet.</p>
          <Link href="/dashboard/sales/invoices/new" className="mt-4 inline-block text-sm font-medium text-teal-600 dark:text-teal-400">
            Create invoice
          </Link>
        </div>
      ) : (
        <DataTableShell
          totalRows={invoices.length}
          filterSlot={<input type="search" placeholder="Search…" className={searchClass} disabled title="Coming soon" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80">
                <tr>
                  <th className="px-4 py-3">Invoice#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => {
                  const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
                  const balance = Number(inv.total) - paid;
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">{inv.customer.displayName}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">{inv.issueDate.toLocaleDateString()}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">
                        {inv.dueDate?.toLocaleDateString() ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(Number(inv.total))}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(balance)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.status}</td>
                      <td className="px-4 py-3 text-right">
                        <InvoiceActionsCell
                          invoiceNumber={inv.invoiceNumber}
                          customerName={inv.customer.displayName}
                          customerEmail={inv.customer.email}
                          issueDate={inv.issueDate.toISOString().slice(0, 10)}
                          dueDate={inv.dueDate?.toISOString().slice(0, 10) ?? "—"}
                          total={fmt(Number(inv.total))}
                          balance={fmt(balance)}
                          status={inv.status}
                          invoiceId={inv.id}
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
