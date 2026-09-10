import { redirect } from "next/navigation";

/** Estimates removed — quotes cover quotations. */
export default function EstimatesRedirectPage() {
  redirect("/dashboard/sales/quotes");
}
