import type { EWayBillDocumentType } from "@prisma/client";
import { DEFAULT_EWAY_VALUE_THRESHOLD_INR } from "@/lib/eway/constants";

export type AutomationSuggestion = {
  required: boolean;
  suggested: boolean;
  reasons: string[];
};

export function evaluateEWayAutomation(opts: {
  documentValue: number;
  isInterState: boolean;
  documentType: EWayBillDocumentType;
  thresholdInr?: number;
  autoSuggestInterstate?: boolean;
  autoSuggestOverThreshold?: boolean;
}): AutomationSuggestion {
  const threshold = opts.thresholdInr ?? DEFAULT_EWAY_VALUE_THRESHOLD_INR;
  const reasons: string[] = [];

  if (opts.autoSuggestOverThreshold !== false && opts.documentValue >= threshold) {
    reasons.push(`Value exceeds Rs ${threshold.toLocaleString("en-IN")}.`);
  }
  if (opts.autoSuggestInterstate !== false && opts.isInterState) {
    reasons.push("Inter-state movement requires E-Way Bill in most cases.");
  }
  if (opts.documentType === "STOCK_TRANSFER") {
    reasons.push("Stock transfer may require E-Way Bill when value exceeds threshold.");
  }
  if (opts.documentType === "JOB_WORK_CHALLAN") {
    reasons.push("Job work movement typically requires supporting E-Way documentation.");
  }
  if (opts.documentType === "EXPORT_SHIPMENT") {
    reasons.push("Export shipments should be documented with E-Way Bill where applicable.");
  }

  const suggested = reasons.length > 0;
  const required = opts.documentValue >= threshold || opts.isInterState;
  return { required, suggested, reasons };
}
