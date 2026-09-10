import { redirect } from "next/navigation";
import { PaymentsListClient } from "@/components/purchases/PaymentsListClient";
import { getSession } from "@/lib/session";

export default async function PaymentsMadePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PaymentsListClient />;
}
