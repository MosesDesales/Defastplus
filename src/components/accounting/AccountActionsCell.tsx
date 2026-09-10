"use client";

import { DocumentRowActions } from "@/components/DocumentRowActions";

export function AccountActionsCell({
  accountId,
  code,
  name,
  typeLabel,
  isActive,
  isSystem,
  openingBalance,
}: Readonly<{
  accountId: string;
  code: string;
  name: string;
  typeLabel: string;
  isActive: boolean;
  isSystem: boolean;
  openingBalance: number;
}>) {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = `${code} — ${name}`;
  const fields: Record<string, string> = {
    Code: code,
    Name: name,
    Type: typeLabel,
    Status: isActive ? "Active" : "Inactive",
    System: isSystem ? "Yes" : "No",
    "Opening balance": fmt(openingBalance),
  };
  const href = `/dashboard/accounting/chart-of-accounts/${accountId}/edit`;
  return <DocumentRowActions title={title} fields={fields} previewHref={href} editHref={href} />;
}
