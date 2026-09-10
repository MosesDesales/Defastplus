import { redirect } from "next/navigation";

export default function BankingUploadRedirectPage() {
  redirect("/banking/statement-upload");
}
