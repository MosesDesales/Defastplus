import { redirect } from "next/navigation";

/** Sales orders removed — use invoices for billing. */
export default function SalesOrdersRedirectPage() {
  redirect("/dashboard/sales/invoices");
}
