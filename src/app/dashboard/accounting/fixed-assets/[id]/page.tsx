import { redirect } from "next/navigation";
import { FixedAssetDetailClient } from "@/components/accounting/FixedAssetDetailClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function FixedAssetDetailPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <FixedAssetDetailClient assetId={id} />;
}
