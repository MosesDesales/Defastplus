"use client";

import { DocumentEWayBillAction } from "@/components/gst/DocumentEWayBillAction";

export function InvoiceEWayBillAction({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  return (
    <DocumentEWayBillAction
      previewUrl={`/api/gst/eway-bills/from-invoice/${invoiceId}`}
      createUrl={`/api/gst/eway-bills/from-invoice/${invoiceId}`}
      documentNumber={invoiceNumber}
      createBody={{ documentType: "TAX_INVOICE" }}
    />
  );
}
