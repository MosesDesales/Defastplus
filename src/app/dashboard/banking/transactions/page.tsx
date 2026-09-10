import { Suspense } from "react";
import { BankingTransactionsClient } from "@/components/banking/BankingTransactionsClient";

export default function BankingTransactionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <BankingTransactionsClient />
    </Suspense>
  );
}
