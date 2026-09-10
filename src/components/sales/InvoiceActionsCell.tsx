"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function InvoiceActionsCell({
  invoiceNumber,
  customerName,
  customerEmail,
  issueDate,
  dueDate,
  total,
  balance,
  status,
  invoiceId,
}: Readonly<{
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  issueDate: string;
  dueDate: string;
  total: string;
  balance: string;
  status: string;
  invoiceId: string;
}>) {
  const title = `Invoice ${invoiceNumber}`;
  const fields: Record<string, string> = {
    Customer: customerName,
    "Issue date": issueDate,
    Due: dueDate,
    Total: total,
    Balance: balance,
    Status: status,
  };
  const editDisabled = status !== "DRAFT";
  return (
    <DocumentRowActions
      title={title}
      fields={fields}
      previewHref={`/dashboard/sales/invoices/${invoiceId}/preview`}
      pdfUrl={`/api/invoices/${invoiceId}/pdf`}
      editHref={`/dashboard/sales/invoices/${invoiceId}`}
      editDisabled={editDisabled}
      email={{
        defaultTo: customerEmail,
        subject: title,
        body: `Please find ${title} attached as a PDF.\n\nRegards,`,
        attachment: { kind: "invoice", id: invoiceId },
      }}
    />
  );
}
