import { redirect } from "next/navigation";
import { PurchaseReturnCreateForm } from "@/components/purchases/PurchaseReturnCreateForm";
import { getSession } from "@/lib/session";

export default async function NewPurchaseReturnPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PurchaseReturnCreateForm />
    </div>
  );
}
