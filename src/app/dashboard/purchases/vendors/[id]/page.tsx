import { redirect } from "next/navigation";
import { VendorProfileClient } from "@/components/purchases/VendorProfileClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function VendorProfilePage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <VendorProfileClient vendorId={id} />;
}
