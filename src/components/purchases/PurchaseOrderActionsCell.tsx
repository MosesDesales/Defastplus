"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function PurchaseOrderActionsCell({
  poId,
  poNumber,
  vendorName,
  poDate,
  status,
  total,
}: Readonly<{
  poId: string;
  poNumber: string;
  vendorName: string;
  poDate: string;
  status: string;
  total: number;
}>) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = `Purchase order ${poNumber}`;
  const fields: Record<string, string> = {
    Vendor: vendorName,
    Date: poDate.slice(0, 10),
    Status: status,
    Total: fmt(total),
  };
  const href = `/dashboard/purchases/purchase-orders/${poId}`;
  return <DocumentRowActions title={title} fields={fields} previewHref={href} editHref={href} />;
}
