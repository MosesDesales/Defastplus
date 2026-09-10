import { redirect } from "next/navigation";
import { ManualJournalListClient } from "@/components/accounting/ManualJournalListClient";
import { getSession } from "@/lib/session";

export default async function ManualJournalIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ManualJournalListClient />;
}
