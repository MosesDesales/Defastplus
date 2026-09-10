import { redirect } from "next/navigation";
import { BillDetailClient } from "@/components/purchases/BillDetailClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function BillDetailPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <BillDetailClient billId={id} />;
}
