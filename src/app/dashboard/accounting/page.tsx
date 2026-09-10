import { redirect } from "next/navigation";

export default function AccountingIndexPage() {
  redirect("/dashboard/accounting/manual-journal");
}
