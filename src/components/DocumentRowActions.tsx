"use client";

import { Eye, FileDown, Mail, Pencil } from "lucide-react";
import { useState } from "react";
import { SendDocumentEmailModal, type EmailAttachmentRef } from "@/components/SendDocumentEmailModal";
import { TableRowActions, type RowAction } from "@/components/TableRowActions";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openPrintPreview(title: string, fields: Record<string, string>) {
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    alert("Pop-up blocked. Allow pop-ups for preview.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111}
table{border-collapse:collapse;width:100%;margin-top:16px}
th,td{border:1px solid #ddd;padding:10px;text-align:left;font-size:14px}
th{width:38%;background:#f8fafc;font-weight:600}
h1{font-size:20px;margin:0}</style></head><body><h1>${escapeHtml(title)}</h1><table>${rows}</table></body></html>`);
  w.document.close();
}

export type DocumentRowActionsProps = {
  title: string;
  fields: Record<string, string>;
  /** Full-page formatted preview (recommended). */
  previewHref: string;
  /** PDF download URL (API route). Omit for rows that have no PDF (e.g. chart of accounts). */
  pdfUrl?: string;
  editHref?: string;
  editDisabled?: boolean;
  email?: {
    defaultTo: string | null;
    subject: string;
    body: string;
    attachment: EmailAttachmentRef;
  };
};

/** Standard ⋮ menu: Preview, Download PDF, Send email, Edit — with icons. */
export function DocumentRowActions({
  title,
  fields,
  previewHref,
  pdfUrl,
  editHref,
  editDisabled,
  email,
}: Readonly<DocumentRowActionsProps>) {
  const [emailOpen, setEmailOpen] = useState(false);

  const actions: RowAction[] = [
    {
      label: "Preview",
      icon: Eye,
      onClick: () => window.open(previewHref, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Download PDF",
      icon: FileDown,
      disabled: !pdfUrl,
      onClick: () => {
        if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
      },
    },
    {
      label: "Send email",
      icon: Mail,
      disabled: !email,
      onClick: () => {
        if (email) setEmailOpen(true);
        else openPrintPreview(title, fields);
      },
    },
  ];

  if (editHref && !editDisabled) {
    actions.push({ label: "Edit", icon: Pencil, href: editHref });
  } else {
    actions.push({ label: "Edit", icon: Pencil, disabled: true });
  }

  return (
    <>
      <TableRowActions actions={actions} />
      {email && emailOpen ? (
        <SendDocumentEmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          defaultTo={email.defaultTo ? email.defaultTo : ""}
          subject={email.subject}
          defaultMessage={email.body}
          attachment={email.attachment}
        />
      ) : null}
    </>
  );
}
