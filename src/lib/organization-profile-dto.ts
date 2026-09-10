import type { CompanyProfile } from "@prisma/client";

/** Client + API shared shape for organization profile payload. */
export type OrganizationProfileDTO = {
  id: string | null;
  companyName: string;
  logoUrl: string;
  industry: string;
  billingCountry: string;
  billingStreet: string;
  billingStreet2: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  phone: string;
  fax: string;
  websiteUrl: string;
  paymentAddressDifferent: boolean;
  paymentStreet: string;
  paymentStreet2: string;
  paymentCity: string;
  paymentState: string;
  paymentZip: string;
  contactName: string;
  contactEmail: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number | null;
  gstin: string;
  pan: string;
  companyIdentifier: string;
  financialYearStartMonth: number;
  currency: string;
  reportBasis: string;
  timezone: string;
  dateFormat: string;
  organizationLanguage: string;
  communicationLanguages: string;
  addressFormatNote: string;
  prefWeekStartsMonday: boolean;
};

export function defaultOrganizationProfileDTO(): OrganizationProfileDTO {
  return {
    id: null,
    companyName: "",
    logoUrl: "",
    industry: "",
    billingCountry: "IN",
    billingStreet: "",
    billingStreet2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    phone: "",
    fax: "",
    websiteUrl: "",
    paymentAddressDifferent: false,
    paymentStreet: "",
    paymentStreet2: "",
    paymentCity: "",
    paymentState: "",
    paymentZip: "",
    contactName: "",
    contactEmail: "",
    smtpEnabled: false,
    smtpHost: "",
    smtpPort: null,
    gstin: "",
    pan: "",
    companyIdentifier: "",
    financialYearStartMonth: 4,
    currency: "INR",
    reportBasis: "ACCRUAL",
    timezone: "Asia/Kolkata",
    dateFormat: "dd/MM/yyyy",
    organizationLanguage: "en",
    communicationLanguages: "en",
    addressFormatNote: "",
    prefWeekStartsMonday: true,
  };
}

export function companyRowToDTO(row: CompanyProfile): OrganizationProfileDTO {
  return {
    id: row.id,
    companyName: row.companyName ?? "",
    logoUrl: row.logoUrl ?? "",
    industry: row.industry ?? "",
    billingCountry: row.billingCountry ?? "IN",
    billingStreet: row.billingStreet ?? "",
    billingStreet2: row.billingStreet2 ?? "",
    billingCity: row.billingCity ?? "",
    billingState: row.billingState ?? "",
    billingZip: row.billingZip ?? "",
    phone: row.phone ?? "",
    fax: row.fax ?? "",
    websiteUrl: row.websiteUrl ?? "",
    paymentAddressDifferent: row.paymentAddressDifferent,
    paymentStreet: row.paymentStreet ?? "",
    paymentStreet2: row.paymentStreet2 ?? "",
    paymentCity: row.paymentCity ?? "",
    paymentState: row.paymentState ?? "",
    paymentZip: row.paymentZip ?? "",
    contactName: row.contactName ?? "",
    contactEmail: row.contactEmail ?? "",
    smtpEnabled: row.smtpEnabled,
    smtpHost: row.smtpHost ?? "",
    smtpPort: row.smtpPort,
    gstin: row.gstin ?? "",
    pan: row.pan ?? "",
    companyIdentifier: row.companyIdentifier ?? "",
    financialYearStartMonth: row.financialYearStartMonth,
    currency: row.currency ?? "INR",
    reportBasis: row.reportBasis ?? "ACCRUAL",
    timezone: row.timezone ?? "Asia/Kolkata",
    dateFormat: row.dateFormat ?? "dd/MM/yyyy",
    organizationLanguage: row.organizationLanguage ?? "en",
    communicationLanguages: row.communicationLanguages ?? "en",
    addressFormatNote: row.addressFormatNote ?? "",
    prefWeekStartsMonday: row.prefWeekStartsMonday,
  };
}
