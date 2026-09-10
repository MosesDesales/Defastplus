import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GeneralLedgerClient } from "@/components/accounting/GeneralLedgerClient";
import { getSession } from "@/lib/session";

export default async function GeneralLedgerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-12 text-sm text-slate-500">Loading ledger…</div>}>
      <GeneralLedgerClient />
    </Suspense>
  );
}
