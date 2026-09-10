import { redirect } from "next/navigation";
import { DeliveryChallanCreateForm } from "@/components/sales/DeliveryChallanCreateForm";
import { getSession } from "@/lib/session";

export default async function NewDeliveryChallanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <DeliveryChallanCreateForm />
    </div>
  );
}
