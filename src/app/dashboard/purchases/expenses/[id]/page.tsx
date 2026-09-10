import { redirect } from "next/navigation";
import { ExpenseDetailClient } from "@/components/purchases/ExpenseDetailClient";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function ExpenseDetailPage(props: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await props.params;
  return <ExpenseDetailClient id={id} />;
}
