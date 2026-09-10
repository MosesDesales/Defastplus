import { Suspense } from "react";
import { BankingReconcileClient } from "@/components/banking/BankingReconcileClient";

export default function BankingReconciliationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <BankingReconcileClient />
    </Suspense>
  );
}
