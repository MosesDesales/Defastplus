import type { EWayBillDocumentType, EWayTransportMode } from "@prisma/client";
import { validateGstinFull } from "@/lib/ocr/gst-validation";
import { normalizeGstin } from "@/lib/gstin";
import {
  DEFAULT_EWAY_VALUE_THRESHOLD_INR,
  HSN_CODE_RE,
  PINCODE_RE,
  STATE_CODE_RE,
  VEHICLE_NUMBER_RE,
} from "@/lib/eway/constants";

export type EWayValidationInput = {
  documentType: EWayBillDocumentType;
  documentValue: number;
  supplierGstin?: string | null;
  supplierStateCode?: string | null;
  supplierPincode?: string | null;
  recipientGstin?: string | null;
  recipientStateCode?: string | null;
  recipientPincode?: string | null;
  transportMode?: EWayTransportMode | null;
  vehicleNumber?: string | null;
  distanceKm?: number | null;
  transporterGstin?: string | null;
  lines: Array<{ productName: string; hsnCode?: string | null; taxableValue: number }>;
  forSubmission?: boolean;
};

export type EWayValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function pushGstinErrors(label: string, gstin: string | null | undefined, errors: string[]) {
  if (!gstin?.trim()) return;
  const r = validateGstinFull(gstin);
  if (!r.valid) errors.push(`${label}: ${r.message ?? "Invalid GSTIN"}`);
}

export function validateEWayBillInput(input: EWayValidationInput): EWayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.supplierStateCode || !STATE_CODE_RE.test(input.supplierStateCode)) {
    errors.push("Supplier state code is required (2-digit GST state code).");
  }
  if (input.supplierPincode && !PINCODE_RE.test(input.supplierPincode)) {
    errors.push("Supplier pincode must be a valid 6-digit Indian pincode.");
  }

  pushGstinErrors("Supplier GSTIN", input.supplierGstin, errors);

  if (input.recipientStateCode && !STATE_CODE_RE.test(input.recipientStateCode)) {
    errors.push("Recipient state code must be a 2-digit GST state code.");
  }
  if (input.recipientPincode && !PINCODE_RE.test(input.recipientPincode)) {
    errors.push("Recipient pincode must be a valid 6-digit Indian pincode.");
  }
  pushGstinErrors("Recipient GSTIN", input.recipientGstin, errors);
  if (input.transporterGstin?.trim()) pushGstinErrors("Transporter GSTIN", input.transporterGstin, errors);

  if (input.documentValue <= 0) errors.push("Document value must be greater than zero.");

  if (input.lines.length === 0) {
    errors.push("At least one line item is required.");
  } else {
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i]!;
      if (!line.productName.trim()) errors.push(`Line ${i + 1}: product name is required.`);
      if (line.hsnCode && !HSN_CODE_RE.test(line.hsnCode.replace(/\D/g, ""))) {
        errors.push(`Line ${i + 1}: HSN/SAC code must be 4–8 digits.`);
      }
      if (line.taxableValue < 0) errors.push(`Line ${i + 1}: taxable value cannot be negative.`);
    }
  }

  if (input.forSubmission) {
    if (!input.transportMode) errors.push("Transport mode is required before submission.");
    if (input.transportMode === "ROAD") {
      const v = input.vehicleNumber?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
      if (!v) {
        errors.push("Vehicle number is required for road transport.");
      } else if (!VEHICLE_NUMBER_RE.test(v)) {
        warnings.push("Vehicle number format may be invalid — verify before submitting to NIC.");
      }
    }
    if (input.distanceKm == null || input.distanceKm < 1) {
      errors.push("Distance in KM is required (minimum 1 km).");
    } else if (input.distanceKm > 4000) {
      warnings.push("Distance exceeds 4000 km — confirm pin-to-pin distance.");
    }
  }

  if (input.documentValue >= DEFAULT_EWAY_VALUE_THRESHOLD_INR && !input.forSubmission) {
    warnings.push(`Document value exceeds Rs ${DEFAULT_EWAY_VALUE_THRESHOLD_INR.toLocaleString("en-IN")} — E-Way Bill is typically required.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeVehicleNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function normalizeHsn(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 8) : null;
}

export function normalizePincode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const d = value.replace(/\D/g, "");
  return d.length === 6 ? d : null;
}

export function duplicateEbnGuard(existingEbn: string | null | undefined, newEbn: string): boolean {
  if (!existingEbn) return true;
  return normalizeGstin(existingEbn) !== normalizeGstin(newEbn);
}
