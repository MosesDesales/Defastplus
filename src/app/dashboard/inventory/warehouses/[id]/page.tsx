import { redirect } from "next/navigation";
import { WarehouseStockDetail } from "@/components/inventory/WarehouseStockDetail";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function WarehouseDetailPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <WarehouseStockDetail warehouseId={id} />;
}
