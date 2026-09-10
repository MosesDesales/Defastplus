import { StatementUploadWizard } from "@/components/banking/StatementUploadWizard";

export default function BankingStatementUploadPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Statement upload</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Upload CSV, Excel, PDF, or images. The app extracts text, parses transactions, and imports unreconciled bank lines.
      </p>
      <StatementUploadWizard />
    </div>
  );
}
