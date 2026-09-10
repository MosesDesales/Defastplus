import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard/inventory/items`. */
export default function LegacyItemsPage() {
  redirect("/dashboard/inventory/items");
}
