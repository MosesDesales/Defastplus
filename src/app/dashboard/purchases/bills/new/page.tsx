import { redirect } from "next/navigation";
import { BillForm } from "@/components/purchases/BillForm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ purchaseOrderId?: string }> };

export default async function NewBillPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await props.searchParams;
  const company = await prisma.companyProfile.findUnique({
    where: { userId: session.sub },
    select: { gstin: true },
  });
  return (
    <div className="pt-2">
      <p className="mx-auto max-w-6xl px-4 text-xs font-semibold uppercase text-teal-600 dark:text-teal-400 sm:px-6">Purchases</p>
      <p className="mx-auto max-w-6xl px-4 pb-2 text-sm text-slate-600 dark:text-slate-400 sm:px-6">
        Record a vendor bill with line taxes, AP account, and withholding — save as draft or post as open (unpaid).
      </p>
      <BillForm purchaseOrderId={sp.purchaseOrderId} companyGstin={company?.gstin ?? null} />
    </div>
  );
}
