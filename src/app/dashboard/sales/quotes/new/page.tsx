import Link from "next/link";
import { redirect } from "next/navigation";
import { QuoteCreateForm } from "@/components/QuoteCreateForm";
import { getNextQuoteNumber } from "@/lib/quote-number";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function NewQuotePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  const [customers, items, defaultQuoteNumber] = await Promise.all([
    prisma.customer.findMany({
      where: { userId: session.sub },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.item.findMany({
      where: { userId: session.sub },
      select: { id: true, name: true, salesRate: true, unit: true },
      orderBy: { name: "asc" },
    }),
    getNextQuoteNumber(session.sub),
  ]);

  const today = new Date();
  const defaultQuoteDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard/sales/quotes"
        className="text-sm font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        ← Quotes
      </Link>

      <QuoteCreateForm
        customers={customers}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          salesRate: Number(i.salesRate),
          unit: i.unit,
        }))}
        defaultQuoteNumber={defaultQuoteNumber}
        defaultQuoteDate={defaultQuoteDate}
        defaultSalespersonName={user?.name ?? "Salesperson"}
      />
    </div>
  );
}
