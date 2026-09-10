"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function QuoteActionsCell({
  quoteId,
  quoteNumber,
  customerName,
  customerEmail,
  quoteDate,
  total,
  status,
}: Readonly<{
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string | null;
  quoteDate: string;
  total: string;
  status: string;
}>) {
  const title = `Quote ${quoteNumber}`;
  const fields: Record<string, string> = {
    Customer: customerName,
    Date: quoteDate,
    Total: total,
    Status: status,
  };
  return (
    <DocumentRowActions
      title={title}
      fields={fields}
      previewHref={`/dashboard/sales/quotes/${quoteId}/preview`}
      pdfUrl={`/api/quotes/${quoteId}/pdf`}
      editHref={`/dashboard/sales/quotes/${quoteId}`}
      editDisabled={status === "SENT"}
      email={{
        defaultTo: customerEmail,
        subject: title,
        body: `Please find ${title} attached as a PDF.\n\nRegards,`,
        attachment: { kind: "quote", id: quoteId },
      }}
    />
  );
}
