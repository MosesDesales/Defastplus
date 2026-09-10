import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard/accounting/*`. */
export default function LegacyAccountantPage() {
  redirect("/dashboard/accounting/manual-journal");
}
