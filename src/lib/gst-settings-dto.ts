import type { CompanyProfile } from "@prisma/client";

export type GstSettingsDTO = {
  gstRegistered: boolean;
  gstin: string;
  gstRegistrationType: string;
  gstBusinessLegalName: string;
  gstBusinessTradeName: string;
  /** yyyy-MM-dd or empty */
  gstRegisteredOn: string;
  gstReverseChargeSales: boolean;
  gstSezOverseasTrading: boolean;
  gstDigitalServicesExport: boolean;
  /** Organization legal name fallback (read-only hint from profile) */
  companyName: string;
};

export function defaultGstSettingsDTO(): GstSettingsDTO {
  return {
    gstRegistered: true,
    gstin: "",
    gstRegistrationType: "",
    gstBusinessLegalName: "",
    gstBusinessTradeName: "",
    gstRegisteredOn: "",
    gstReverseChargeSales: false,
    gstSezOverseasTrading: false,
    gstDigitalServicesExport: false,
    companyName: "",
  };
}

export function rowToGstSettingsDTO(row: CompanyProfile | null): GstSettingsDTO {
  if (!row) return defaultGstSettingsDTO();
  const legal = row.gstBusinessLegalName?.trim() || row.companyName?.trim() || "";
  const on = row.gstRegisteredOn;
  return {
    gstRegistered: row.gstRegistered,
    gstin: row.gstin ?? "",
    gstRegistrationType: row.gstRegistrationType ?? "",
    gstBusinessLegalName: legal,
    gstBusinessTradeName: row.gstBusinessTradeName ?? "",
    gstRegisteredOn: on ? on.toISOString().slice(0, 10) : "",
    gstReverseChargeSales: row.gstReverseChargeSales,
    gstSezOverseasTrading: row.gstSezOverseasTrading,
    gstDigitalServicesExport: row.gstDigitalServicesExport,
    companyName: row.companyName ?? "",
  };
}
