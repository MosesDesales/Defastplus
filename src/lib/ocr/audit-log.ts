import type { OcrAuditEntry } from "@/lib/ocr/types";

export function auditEntry(stage: string, message: string, detail?: string): OcrAuditEntry {
  return {
    at: new Date().toISOString(),
    stage,
    message,
    detail,
  };
}

export function appendAudit(
  log: OcrAuditEntry[] | undefined,
  stage: string,
  message: string,
  detail?: string,
): OcrAuditEntry[] {
  return [...(log ?? []), auditEntry(stage, message, detail)];
}
