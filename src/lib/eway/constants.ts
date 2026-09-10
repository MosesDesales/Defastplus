import type { EWayBillDocumentType, EWayBillStatus, EWayTransportMode } from "@prisma/client";

/** Statutory default — Rs 50,000 (goods); company can override in settings. */
export const DEFAULT_EWAY_VALUE_THRESHOLD_INR = 50_000;

export const EWAY_DOCUMENT_TYPE_LABELS: Record<EWayBillDocumentType, string> = {
  TAX_INVOICE: "Tax Invoice",
  BILL_OF_SUPPLY: "Bill of Supply",
  DELIVERY_CHALLAN: "Delivery Challan",
  JOB_WORK_CHALLAN: "Job Work Challan",
  STOCK_TRANSFER: "Stock Transfer",
  PURCHASE_RETURN: "Purchase Return",
  EXPORT_SHIPMENT: "Export Shipment",
};

export const EWAY_STATUS_LABELS: Record<EWayBillStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready for Submission",
  GENERATED: "Generated",
  IN_TRANSIT: "In Transit",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  ERROR: "Error",
};

export const EWAY_TRANSPORT_MODE_LABELS: Record<EWayTransportMode, string> = {
  ROAD: "Road",
  RAIL: "Rail",
  AIR: "Air",
  SHIP: "Ship",
};

/** Basic Indian vehicle number pattern (flexible for state formats). */
export const VEHICLE_NUMBER_RE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/i;

export const HSN_CODE_RE = /^[0-9]{4,8}$/;

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export const STATE_CODE_RE = /^[0-9]{2}$/;
