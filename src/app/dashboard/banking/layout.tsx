import { BankingSubnav } from "@/components/banking/BankingSubnav";

export default function BankingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Banking</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Cash & bank</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Import statements, match lines to invoices and bills, and keep payment statuses in sync.
        </p>
      </div>
      <BankingSubnav />
      {children}
    </div>
  );
}
