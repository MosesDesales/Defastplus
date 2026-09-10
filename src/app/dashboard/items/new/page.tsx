import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard/inventory/items/new`. */
export default function LegacyNewItemPage() {
  redirect("/dashboard/inventory/items/new");
}
