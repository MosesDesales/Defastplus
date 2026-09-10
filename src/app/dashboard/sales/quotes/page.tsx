import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTableShell } from "@/components/DataTableShell";
import { PageToolbar } from "@/components/PageToolbar";
import { QuoteActionsCell } from "@/components/sales/QuoteActionsCell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const searchInputClass =
  "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default async function QuotesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const quotes = await prisma.quote.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    include: { customer: { select: { displayName: true, email: true } } },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Sales</p>
      <PageToolbar
        title="Quotes"
        subtitle="Quotations with line items, tax, and statuses — convert to invoices when accepted."
        newButton={{ href: "/dashboard/sales/quotes/new", label: "+ New quote" }}
      />

      {quotes.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-slate-600 dark:text-slate-400">No quotes yet.</p>
          <Link
            href="/dashboard/sales/quotes/new"
            className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            Create your first quote
          </Link>
        </div>
      ) : (
        <DataTableShell
          totalRows={quotes.length}
          filterSlot={
            <input type="search" placeholder="Search quotes…" className={searchInputClass} disabled title="Server-side search coming soon" />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Quote#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total (₹)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotes.map((q) => (
                  <tr key={q.id} className="text-slate-800 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">{q.quoteNumber}</td>
                    <td className="px-4 py-3">{q.customer.displayName}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">
                      {q.quoteDate.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                      {fmt(Number(q.total))}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{q.status}</td>
                    <td className="px-4 py-3 text-right">
                      <QuoteActionsCell
                        quoteId={q.id}
                        quoteNumber={q.quoteNumber}
                        customerName={q.customer.displayName}
                        customerEmail={q.customer.email}
                        quoteDate={q.quoteDate.toISOString().slice(0, 10)}
                        total={fmt(Number(q.total))}
                        status={q.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      )}
    </div>
  );
}
