import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEWayBillInput, normalizeVehicleNumber } from "@/lib/eway/validation";
import { resolveNumericStateCode } from "@/lib/eway/state-codes";
import { evaluateEWayAutomation } from "@/lib/eway/automation";

describe("E-Way validation", () => {
  it("rejects submission without vehicle for road transport", () => {
    const r = validateEWayBillInput({
      documentType: "TAX_INVOICE",
      documentValue: 75000,
      supplierStateCode: "27",
      recipientStateCode: "29",
      transportMode: "ROAD",
      vehicleNumber: "",
      distanceKm: 100,
      lines: [{ productName: "Widget", hsnCode: "8471", taxableValue: 75000 }],
      forSubmission: true,
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("Vehicle")));
  });

  it("accepts valid draft with GSTIN", () => {
    const r = validateEWayBillInput({
      documentType: "TAX_INVOICE",
      documentValue: 10000,
      supplierGstin: "27AAPFU0939F1ZV",
      supplierStateCode: "27",
      recipientStateCode: "29",
      lines: [{ productName: "Item", hsnCode: "1001", taxableValue: 10000 }],
    });
    assert.equal(r.valid, true);
  });

  it("normalizes vehicle numbers", () => {
    assert.equal(normalizeVehicleNumber("mh 12 ab 1234"), "MH12AB1234");
  });
});

describe("State code resolution", () => {
  it("reads state from GSTIN", () => {
    assert.equal(resolveNumericStateCode({ gstin: "27AAPFU0939F1ZV" }), "27");
  });

  it("maps Maharashtra name", () => {
    assert.equal(resolveNumericStateCode({ stateNameOrCode: "Maharashtra" }), "27");
  });
});

describe("Automation", () => {
  it("suggests inter-state", () => {
    const r = evaluateEWayAutomation({
      documentValue: 1000,
      isInterState: true,
      documentType: "TAX_INVOICE",
    });
    assert.equal(r.suggested, true);
    assert.equal(r.required, true);
  });
});
