import { redirect } from "next/navigation";

export default function TaxesSettingsIndexPage() {
  redirect("/dashboard/settings/taxes/gst");
}
