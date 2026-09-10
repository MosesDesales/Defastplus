import { redirect } from "next/navigation";
import { PurchaseOrderDetailClient } from "@/components/purchases/PurchaseOrderDetailClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function PurchaseOrderDetailPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <PurchaseOrderDetailClient poId={id} />;
}
