import { redirect } from "next/navigation";
import { EWayBillDetailClient } from "@/components/gst/EWayBillDetailClient";
import { getSession } from "@/lib/session";

export default async function EWayBillDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <EWayBillDetailClient id={id} />;
}
