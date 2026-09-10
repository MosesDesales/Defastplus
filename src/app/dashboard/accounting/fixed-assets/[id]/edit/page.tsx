import { redirect } from "next/navigation";
import { FixedAssetFormClient } from "@/components/accounting/FixedAssetFormClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function EditFixedAssetPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <FixedAssetFormClient assetId={id} />;
}
