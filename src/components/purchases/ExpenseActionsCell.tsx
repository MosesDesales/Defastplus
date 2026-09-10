"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function ExpenseActionsCell({
  expenseId,
  expenseDate,
  expenseAccountCode,
  bankAccountCode,
  amount,
  taxAmount,
  notes,
  posted,
}: Readonly<{
  expenseId: string;
  expenseDate: string;
  expenseAccountCode: string;
  bankAccountCode: string;
  amount: number;
  taxAmount: number;
  notes: string | null;
  posted: boolean;
}>) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = `Expense ${expenseDate.slice(0, 10)}`;
  const fields: Record<string, string> = {
    Date: expenseDate.slice(0, 10),
    "Expense acct": expenseAccountCode,
    Bank: bankAccountCode,
    Amount: fmt(amount),
    Tax: fmt(taxAmount),
    Posted: posted ? "Yes" : "No",
    Description: notes?.trim() || "—",
  };
  return (
    <DocumentRowActions
      title={title}
      fields={fields}
      previewHref={`/dashboard/purchases/expenses/${expenseId}/preview`}
      pdfUrl={`/api/purchases/expenses/${expenseId}/pdf`}
      editHref={`/dashboard/purchases/expenses/${expenseId}`}
      editDisabled={posted}
      email={{
        defaultTo: "",
        subject: title,
        body: `Expense details are attached as a PDF.\n\n${notes?.trim() || ""}`,
        attachment: { kind: "expense", id: expenseId },
      }}
    />
  );
}
