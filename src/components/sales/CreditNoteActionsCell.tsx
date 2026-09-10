"use client";

import { Eye, FileDown, Mail, Pencil, Receipt } from "lucide-react";
import { useState } from "react";
import { SendDocumentEmailModal } from "@/components/SendDocumentEmailModal";
import { TableRowActions, type RowAction } from "@/components/TableRowActions";

export function CreditNoteActionsCell({
  creditNoteId,
  creditNumber,
  customerName,
  customerEmail,
  issueDate,
  total,
  status,
  reason,
  balance,
  balanceNum,
  onApply,
}: Readonly<{
  creditNoteId: string;
  creditNumber: string;
  customerName: string;
  customerEmail: string | null;
  issueDate: string;
  total: string;
  status: string;
  reason: string | null;
  balance: string;
  balanceNum: number;
  onApply: () => void;
}>) {
  const [emailOpen, setEmailOpen] = useState(false);
  const previewHref = `/dashboard/sales/credit-notes/${creditNoteId}/preview`;
  const pdfUrl = `/api/sales/credit-notes/${creditNoteId}/pdf`;
  const canApply = status === "OPEN" && balanceNum > 0.005;

  const actions: RowAction[] = [];
  if (canApply) {
    actions.push({
      label: "Apply to invoice",
      icon: Receipt,
      onClick: onApply,
    });
  }
  actions.push(
    {
      label: "Preview",
      icon: Eye,
      onClick: () => window.open(previewHref, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Download PDF",
      icon: FileDown,
      onClick: () => window.open(pdfUrl, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Send email",
      icon: Mail,
      disabled: !customerEmail,
      onClick: () => {
        if (customerEmail) setEmailOpen(true);
      },
    },
    { label: "Edit", icon: Pencil, disabled: true },
  );

  return (
    <>
      <div className="flex justify-end">
        <TableRowActions actions={actions} />
      </div>
      {customerEmail && emailOpen ? (
        <SendDocumentEmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          defaultTo={customerEmail}
          subject={`Credit note ${creditNumber}`}
          defaultMessage={`Please find attached credit note ${creditNumber} for ${customerName}.`}
          attachment={{ kind: "credit-note", id: creditNoteId }}
        />
      ) : null}
    </>
  );
}
