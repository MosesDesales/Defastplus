"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

function humanFrequency(f: string) {
  const m: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
  return m[f] ?? f;
}

export function RecurringExpenseActionsCell({
  recurringId,
  frequency,
  nextRunDate,
  amount,
  expenseAccountCode,
  bankAccountCode,
  vendorName,
  customerName,
  notes,
  isActive,
}: Readonly<{
  recurringId: string;
  frequency: string;
  nextRunDate: string;
  amount: number;
  expenseAccountCode: string;
  bankAccountCode: string;
  vendorName: string | null;
  customerName: string | null;
  notes: string | null;
  isActive: boolean;
}>) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = `Recurring expense (${humanFrequency(frequency)})`;
  const fields: Record<string, string> = {
    Frequency: humanFrequency(frequency),
    "Next run": nextRunDate.slice(0, 10),
    Amount: fmt(amount),
    "Expense acct": expenseAccountCode,
    "Paid through": bankAccountCode,
    Vendor: vendorName?.trim() || "—",
    Customer: customerName?.trim() || "—",
    Notes: notes?.trim() || "—",
    Active: isActive ? "Yes" : "No",
  };
  const editHref = `/dashboard/purchases/recurring-expenses/${recurringId}/edit`;
  return (
    <DocumentRowActions
      title={title}
      fields={fields}
      previewHref={editHref}
      editHref={editHref}
    />
  );
}
