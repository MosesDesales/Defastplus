"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function BillActionsCell({
  billId,
  billNumber,
  vendorName,
  vendorEmail,
  billDate,
  total,
  balance,
  status,
}: Readonly<{
  billId: string;
  billNumber: string;
  vendorName: string;
  vendorEmail: string | null;
  billDate: string;
  total: string;
  balance: string;
  status: string;
}>) {
  const title = `Bill ${billNumber}`;
  const fields: Record<string, string> = {
    Vendor: vendorName,
    Date: billDate,
    Total: total,
    Balance: balance,
    Status: status,
  };
  const editDisabled = status === "PAID" || status === "VOID";
  return (
    <DocumentRowActions
      title={title}
      fields={fields}
      previewHref={`/dashboard/purchases/bills/${billId}/preview`}
      pdfUrl={`/api/purchases/bills/${billId}/pdf`}
      editHref={`/dashboard/purchases/bills/${billId}`}
      editDisabled={editDisabled}
      email={{
        defaultTo: vendorEmail,
        subject: title,
        body: `Please find ${title} attached as a PDF.\n\nRegards,`,
        attachment: { kind: "bill", id: billId },
      }}
    />
  );
}
