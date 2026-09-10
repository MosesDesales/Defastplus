import { email, z } from "zod";
import { DOCUMENT_TEMPLATE_TYPES } from "@/lib/document-template-types";
import { GST_RATE_OPTIONS } from "@/lib/gst/line-india-tax";

const documentTemplateTypeSchema = z.enum(DOCUMENT_TEMPLATE_TYPES as unknown as [string, ...string[]]);

export const documentTemplateCreateSchema = z.object({
  type: documentTemplateTypeSchema,
  name: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  moduleNames: z.array(documentTemplateTypeSchema).min(1).max(32).optional(),
});

export const documentTemplatePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  moduleNames: z.array(documentTemplateTypeSchema).min(1).max(32).optional(),
  exportFileNamePattern: z.union([z.string().trim().min(1).max(200), z.null()]).optional(),
  thumbnailUrl: z.union([z.string().max(400_000), z.null()]).optional(),
});

export const templateSetDefaultBodySchema = z.object({
  moduleName: documentTemplateTypeSchema,
});

export const templateWorkspaceExportSchema = z.object({
  defaultPdfExportFilenamePattern: z.string().trim().min(1).max(200),
});

export const registerSchema = z.object({
  email: email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1).max(128),
});

const moneyField = z.coerce.number().finite().min(0).max(999_999_999.9999);

/** Opening balances / adjustments may be negative (e.g. vendor credit balance). */
const signedMoneyField = z.coerce.number().finite().min(-999_999_999.9999).max(999_999_999.9999);

const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  email().optional(),
);

export const customerCreateSchema = z.object({
  customerType: z.enum(["BUSINESS", "INDIVIDUAL"]),
  salutation: z.string().trim().max(40).optional().nullable(),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  companyName: z.string().trim().max(200).optional().nullable(),
  displayName: z.string().trim().min(1).max(200),
  gstin: z.string().trim().max(20).optional().nullable(),
  email: optionalEmail,
  workPhoneCountryCode: z.string().trim().max(8),
  workPhone: z.string().trim().max(40).optional().nullable(),
  mobileCountryCode: z.string().trim().max(8),
  mobile: z.string().trim().max(40).optional().nullable(),
  customerLanguage: z.string().trim().min(2).max(16),
  billingAttention: z.string().trim().max(200).optional().nullable(),
  billingStreet: z.string().trim().max(500).optional().nullable(),
  billingCity: z.string().trim().max(120).optional().nullable(),
  billingState: z.string().trim().max(120).optional().nullable(),
  billingZip: z.string().trim().max(40).optional().nullable(),
  billingCountry: z.string().trim().min(2).max(120),
  pan: z.string().trim().max(20).optional().nullable(),
  currency: z.string().trim().min(3).max(8),
  accountsReceivableAccount: z.string().trim().max(200).optional().nullable(),
  openingBalance: moneyField,
  paymentTerms: z.enum(["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"]),
  portalEnabled: z.boolean(),
  remarks: z.string().trim().max(5000).optional().nullable(),
});

const quoteLineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
});

export const quoteCreateSchema = z.object({
  customerId: z.string().min(1),
  quoteNumber: z.string().trim().min(1).max(40),
  reference: z.string().trim().max(120).optional().nullable(),
  quoteDate: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
  salesperson: z.string().trim().max(120).optional().nullable(),
  projectName: z.string().trim().max(200).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  customerNotes: z.string().trim().max(5000).optional().nullable(),
  termsAndConditions: z.string().trim().max(10000).optional().nullable(),
  discountMode: z.enum(["PERCENT", "AMOUNT"]),
  discountInput: moneyField,
  withholdingType: z.enum(["TDS", "TCS", "NONE"]),
  taxSelectLabel: z.string().trim().max(200).optional().nullable(),
  taxAmount: moneyField,
  adjustmentLabel: z.string().trim().max(120),
  adjustmentAmount: z.coerce.number().finite(),
  pdfTemplate: z.string().trim().max(200),
  status: z.enum(["DRAFT", "SENT"]),
  lines: z.array(quoteLineSchema).min(1),
});

const invoiceLineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
  taxPercent: moneyField,
});

const documentCurrencyFieldsSchema = {
  currency: z.string().trim().min(3).max(8).optional(),
  exchangeRate: z.coerce.number().positive().optional().nullable(),
};

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1),
  invoiceNumber: z.string().trim().min(1).max(40).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  issueDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  ...documentCurrencyFieldsSchema,
  status: z.enum(["DRAFT", "SENT"]),
  quoteId: z.string().optional().nullable(),
  documentTemplateId: z.string().trim().min(1).optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  withholdingType: z.enum(["NONE", "TDS", "TCS"]).optional().default("NONE"),
  withholdingPercent: z.coerce.number().min(0).max(100).optional().default(0),
  adjustmentLabel: z.string().trim().max(120).optional().default("Adjustment"),
  adjustmentAmount: z.coerce.number().finite().optional().default(0),
});

export const invoicePatchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "VOID"]).optional(),
});

const recurringInvoiceLineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
  taxPercent: moneyField.optional(),
});

export const recurringInvoiceCreateSchema = z.object({
  customerId: z.string().min(1),
  profileName: z.string().trim().max(200).optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  repeatEvery: z.coerce.number().int().min(1).max(366).default(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  nextRunDate: z.string().optional().nullable(),
  autoEmail: z.boolean().optional().default(false),
  status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).optional(),
  lines: z.array(recurringInvoiceLineSchema).min(1),
});

export const recurringInvoicePatchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]),
});

const creditNoteLineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
  taxPercent: moneyField.optional(),
});

export const creditNoteCreateSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  creditNumber: z.string().trim().min(1).max(40).optional(),
  issueDate: z.string().min(1),
  reason: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(creditNoteLineSchema).min(1),
  /** If true, status becomes OPEN and GL reversal is posted immediately. */
  issueNow: z.boolean().optional().default(false),
});

export const deliveryChallanCreateSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  challanNumber: z.string().trim().min(1).max(40).optional(),
  challanDate: z.string().min(1),
  reference: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(creditNoteLineSchema).min(1),
  dispatchNow: z.boolean().optional().default(false),
});

export const purchaseReturnCreateSchema = z.object({
  vendorId: z.string().min(1),
  vendorBillId: z.string().optional().nullable(),
  returnNumber: z.string().trim().min(1).max(40).optional(),
  returnDate: z.string().min(1),
  reference: z.string().trim().max(200).optional().nullable(),
  reason: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(creditNoteLineSchema).min(1),
  dispatchNow: z.boolean().optional().default(false),
});

export const creditNoteApplySchema = z.object({
  invoiceId: z.string().min(1),
  amount: moneyField,
});

const paymentAllocationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: moneyField,
});

export const paymentCreateSchema = z.object({
  customerId: z.string().min(1),
  paymentNumber: z.string().trim().min(1).max(40).optional(),
  paymentDate: z.string().min(1),
  mode: z.enum(["CASH", "BANK", "UPI", "CARD", "OTHER"]),
  reference: z.string().trim().max(120).optional().nullable(),
  memo: z.string().trim().max(500).optional().nullable(),
  amount: moneyField,
  allocations: z.array(paymentAllocationSchema).min(1),
});

const gstTaxPreferenceSchema = z.enum(["TAXABLE", "NON_TAXABLE", "EXEMPT", "NIL_RATED"]);
const gstTaxModeSchema = z.enum(["AUTO", "INTRA", "INTER"]);

const itemGstFields = {
  gstTaxPreference: gstTaxPreferenceSchema.optional(),
  gstApplicable: z.boolean().optional(),
  gstRate: moneyField.optional(),
  hsnCode: z.string().trim().max(32).optional().nullable(),
  gstTaxMode: gstTaxModeSchema.optional(),
  reverseCharge: z.boolean().optional(),
  itcEligible: z.boolean().optional(),
};

export const itemCreateSchema = z
  .object({
    itemType: z.enum(["GOODS", "SERVICE"]),
    name: z.string().trim().min(1).max(200),
    sku: z.string().trim().max(80).optional().nullable(),
    unit: z.string().trim().min(1).max(40),
    salesDescription: z.string().trim().max(2000).optional().nullable(),
    purchaseDescription: z.string().trim().max(2000).optional().nullable(),
    salesRate: moneyField,
    purchaseRate: moneyField,
    sellable: z.boolean(),
    purchasable: z.boolean(),
    categoryId: z.string().trim().min(1).optional().nullable(),
    inventoryUnitId: z.string().trim().min(1).optional().nullable(),
    reorderLevel: moneyField.optional(),
    isActive: z.boolean().optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    openingStock: moneyField.optional(),
    warehouseId: z.string().trim().min(1).optional().nullable(),
    autoSku: z.boolean().optional(),
    ...itemGstFields,
  })
  .superRefine((data, ctx) => {
    const gstAware =
      data.gstTaxPreference !== undefined ||
      data.gstApplicable !== undefined ||
      data.gstRate !== undefined ||
      (data.hsnCode !== undefined && data.hsnCode !== null && String(data.hsnCode).trim() !== "") ||
      data.gstTaxMode !== undefined ||
      data.reverseCharge !== undefined ||
      data.itcEligible !== undefined;
    const pref = data.gstTaxPreference ?? (gstAware ? "TAXABLE" : "NON_TAXABLE");
    const rate = data.gstRate ?? 0;
    const hsn = data.hsnCode?.trim() ?? "";
    if (pref === "TAXABLE") {
      if (!(GST_RATE_OPTIONS as readonly number[]).includes(rate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GST rate must be 0%, 5%, 12%, 18%, or 28% for taxable items.",
          path: ["gstRate"],
        });
      }
      if (!hsn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "HSN/SAC is required for taxable items.",
          path: ["hsnCode"],
        });
      }
    } else if (rate > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GST rate must be 0 when tax preference is not Taxable.",
        path: ["gstRate"],
      });
    }
  });

export const itemCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const inventoryUnitSchema = z.object({
  name: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().max(16).optional().nullable(),
});

export const warehouseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const stockAdjustmentSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantityDelta: z.coerce.number().finite(),
  reason: z.string().trim().min(1).max(1000),
});

export const inventorySettingsSchema = z.object({
  valuationMethod: z.enum(["FIFO", "WEIGHTED_AVERAGE"]),
});

export const inventoryItemUpdateSchema = z.object({
  itemType: z.enum(["GOODS", "SERVICE"]).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(40).optional(),
  salesDescription: z.string().trim().max(2000).optional().nullable(),
  purchaseDescription: z.string().trim().max(2000).optional().nullable(),
  salesRate: moneyField.optional(),
  purchaseRate: moneyField.optional(),
  sellable: z.boolean().optional(),
  purchasable: z.boolean().optional(),
  categoryId: z.string().trim().min(1).optional().nullable(),
  inventoryUnitId: z.string().trim().min(1).optional().nullable(),
  reorderLevel: moneyField.optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  ...itemGstFields,
});

/** After merging PATCH fields onto an existing item row, validate GST rules. */
export function validateMergedItemGstRules(input: {
  gstTaxPreference: string;
  gstRate: number;
  hsnCode: string | null | undefined;
}): string | null {
  const pref = input.gstTaxPreference;
  const rate = input.gstRate;
  const hsn = input.hsnCode?.trim() ?? "";
  if (pref === "TAXABLE") {
    if (!(GST_RATE_OPTIONS as readonly number[]).includes(rate)) {
      return "GST rate must be 0%, 5%, 12%, 18%, or 28% for taxable items.";
    }
    if (!hsn) return "HSN/SAC is required for taxable items.";
    return null;
  }
  if (rate > 0) return "GST rate must be 0 when tax preference is not Taxable.";
  return null;
}

const accountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(40).optional().nullable(),
  autoCode: z.boolean().optional(),
  type: accountTypeEnum,
  parentId: z.string().trim().min(1).optional().nullable(),
  openingBalance: moneyField.optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const accountPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(40).optional().nullable(),
  type: accountTypeEnum.optional(),
  parentId: z.string().trim().min(1).optional().nullable(),
  openingBalance: moneyField.optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const manualJournalLineSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().trim().max(500).optional().nullable(),
  debit: moneyField,
  credit: moneyField,
});

export const manualJournalUpsertSchema = z.object({
  entryDate: z.string().min(1),
  referenceNo: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(manualJournalLineSchema).min(2),
  action: z.enum(["draft", "post"]),
});

const fixedAssetMoney = z.coerce.number().finite().min(0.01).max(999_999_999.9999);
const salvageMoney = z.coerce.number().finite().min(0).max(999_999_999.9999);

const fixedAssetBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  assetCode: z.string().trim().min(1).max(40),
  category: z.string().trim().max(120).optional().nullable(),
  purchaseDate: z.string().min(1),
  purchaseCost: fixedAssetMoney,
  salvageValue: salvageMoney,
  usefulLifeYears: z.coerce.number().int().min(1).max(200),
  depreciationMethod: z.enum(["STRAIGHT_LINE", "WRITTEN_DOWN_VALUE"]),
  wdvAnnualPercent: z.coerce.number().finite().positive().max(100).optional().nullable(),
  depreciationStartDate: z.string().min(1),
  scheduleFrequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  assetAccountId: z.string().min(1),
  depreciationExpenseAccountId: z.string().min(1),
  accumulatedDepreciationAccountId: z.string().min(1),
});

export const fixedAssetCreateSchema = fixedAssetBaseSchema
  .refine((d) => d.salvageValue < d.purchaseCost, { message: "Salvage value must be less than purchase cost." })
  .refine(
    (d) => d.depreciationMethod !== "WRITTEN_DOWN_VALUE" || (d.wdvAnnualPercent != null && d.wdvAnnualPercent > 0),
    { message: "WDV requires a positive annual depreciation percent." },
  );

export const fixedAssetPatchSchema = fixedAssetBaseSchema.partial().superRefine((d, ctx) => {
  if (d.purchaseCost != null && d.salvageValue != null && d.salvageValue >= d.purchaseCost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Salvage value must be less than purchase cost.",
    });
  }
  if (
    d.depreciationMethod === "WRITTEN_DOWN_VALUE" &&
    d.wdvAnnualPercent != null &&
    d.wdvAnnualPercent <= 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "WDV requires a positive annual depreciation percent.",
    });
  }
});

export const fixedAssetDisposalSchema = z
  .object({
    type: z.enum(["SELL", "SCRAP"]),
    proceeds: z.coerce.number().finite().min(0).max(999_999_999.9999).optional(),
    cashAccountId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => d.type !== "SELL" || (d.proceeds ?? 0) <= 0 || Boolean(d.cashAccountId?.trim()), {
    message: "Cash / bank account is required when selling for a positive amount.",
  });

export const depreciationRunSchema = z.object({
  asOf: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  dryRun: z.boolean().optional(),
});

const currencyFields = {
  code: z.string().trim().min(2).max(8),
  symbol: z.string().trim().min(1).max(12),
  name: z.string().trim().min(1).max(120),
  decimalPlaces: z.coerce.number().int().min(0).max(6).default(2),
  formatLocale: z.string().trim().min(2).max(40).default("en-IN"),
  exchangeRate: z.coerce.number().finite().positive().max(1e12).optional().nullable(),
  isBaseCurrency: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

export const currencyCreateSchema = z.object(currencyFields).transform((d) => ({
  ...d,
  code: d.code.toUpperCase(),
}));

export const currencyUpdateSchema = z.object(currencyFields).partial();

export const currencyFeedsSchema = z.object({
  exchangeRateFeedsEnabled: z.boolean(),
});

// ---- Purchases ----

export const vendorPaymentTermsEnum = z.enum(["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"]);

export const vendorCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional().nullable(),
  salutation: z.string().trim().max(40).optional().nullable(),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  workPhoneCountryCode: z.string().trim().max(10).optional(),
  workPhone: z.string().trim().max(40).optional().nullable(),
  mobileCountryCode: z.string().trim().max(10).optional(),
  mobile: z.string().trim().max(40).optional().nullable(),
  vendorLanguage: z.string().trim().max(20).optional(),
  gstin: z.string().trim().max(20).optional().nullable(),
  billingAttention: z.string().trim().max(200).optional().nullable(),
  billingStreet: z.string().trim().max(500).optional().nullable(),
  billingCity: z.string().trim().max(120).optional().nullable(),
  billingState: z.string().trim().max(120).optional().nullable(),
  billingZip: z.string().trim().max(40).optional().nullable(),
  billingCountry: z.string().trim().max(120).optional().nullable(),
  pan: z.string().trim().max(20).optional().nullable(),
  msmeRegistered: z.boolean().optional(),
  currency: z.string().trim().max(10).optional(),
  accountsPayableAccountId: z.string().trim().optional().nullable(),
  paymentTerms: vendorPaymentTermsEnum.optional(),
  tdsAccountId: z.string().trim().optional().nullable(),
  portalEnabled: z.boolean().optional(),
  openingBalance: signedMoneyField.optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const vendorPatchSchema = vendorCreateSchema.partial();

export const purchaseExpenseCreateSchema = z.object({
  expenseDate: z.string().min(1),
  expenseAccountId: z.string().trim().min(1),
  bankAccountId: z.string().trim().min(1),
  vendorId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  invoiceNumber: z.string().trim().max(120).optional().nullable(),
  amount: moneyField,
  taxAmount: moneyField.optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  attachmentUrl: z.string().trim().max(2000).optional().nullable(),
});

export const recurringExpenseSchema = z.object({
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  expenseAccountId: z.string().trim().min(1),
  bankAccountId: z.string().trim().min(1),
  vendorId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  amount: moneyField,
  taxAmount: moneyField.optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const recurringExpensePatchSchema = recurringExpenseSchema.partial();

export const poLineSchema = z.object({
  itemId: z.string().trim().min(1).optional().nullable(),
  expenseAccountId: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
  taxPercent: moneyField.optional(),
  sortOrder: z.number().int().optional(),
});

export const purchaseOrderUpsertSchema = z.object({
  vendorId: z.string().trim().min(1),
  poNumber: z.string().trim().max(80).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  poDate: z.string().min(1),
  expectedDate: z.string().optional().nullable(),
  ...documentCurrencyFieldsSchema,
  memo: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "RECEIVED", "BILLED", "CANCELLED"]).optional(),
  deliveryMode: z.enum(["ORGANIZATION", "CUSTOMER"]).optional(),
  deliveryCustomerId: z.string().trim().optional().nullable(),
  deliverySnapshot: z.string().trim().max(5000).optional().nullable(),
  paymentTerms: z.string().trim().max(80).optional(),
  shipmentPreference: z.string().trim().max(200).optional().nullable(),
  termsAndConditions: z.string().trim().max(10000).optional().nullable(),
  discountPercent: z.coerce.number().finite().min(0).max(100).optional(),
  adjustmentAmount: signedMoneyField.optional(),
  withholdingType: z.enum(["NONE", "TDS", "TCS"]).optional(),
  withholdingAmount: moneyField.optional(),
  pdfTemplate: z.string().trim().max(200).optional().nullable(),
  lines: z.array(poLineSchema).min(1),
});

export const billLineSchema = z.object({
  itemId: z.string().trim().min(1).optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1).max(2000),
  quantity: moneyField,
  rate: moneyField,
  discountPercent: moneyField.optional(),
  taxPercent: moneyField.optional(),
  expenseAccountId: z.string().trim().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const vendorBillUpsertSchema = z.object({
  vendorId: z.string().trim().min(1),
  billNumber: z.string().trim().max(80).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  orderNumber: z.string().trim().max(120).optional().nullable(),
  subject: z.string().trim().max(250).optional().nullable(),
  billDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  ...documentCurrencyFieldsSchema,
  paymentTerms: z.string().trim().max(80).optional(),
  accountsPayableAccountId: z.string().trim().optional().nullable(),
  notesInternal: z.string().trim().max(5000).optional().nullable(),
  purchaseOrderId: z.string().trim().min(1).optional().nullable(),
  status: z.enum(["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "VOID"]).optional(),
  withholdingType: z.enum(["NONE", "TDS", "TCS"]).optional(),
  withholdingAmount: moneyField.optional(),
  adjustmentAmount: signedMoneyField.optional(),
  pdfTemplate: z.string().trim().max(200).optional().nullable(),
  lines: z.array(billLineSchema).min(1),
});

export const recurringVendorBillSchema = z.object({
  vendorId: z.string().trim().min(1),
  profileName: z.string().trim().min(1).max(200),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  paymentTerms: z.string().trim().max(80).optional(),
  accountsPayableAccountId: z.string().trim().optional().nullable(),
  notesInternal: z.string().trim().max(5000).optional().nullable(),
  memo: z.string().trim().max(5000).optional().nullable(),
  discountPercent: z.coerce.number().finite().min(0).max(100).optional(),
  withholdingType: z.enum(["NONE", "TDS", "TCS"]).optional(),
  withholdingAmount: moneyField.optional(),
  adjustmentAmount: signedMoneyField.optional(),
  lines: z.array(billLineSchema).min(1),
});

export const vendorPaymentCreateSchema = z.object({
  vendorId: z.string().trim().min(1),
  paymentNumber: z.string().trim().max(80).optional().nullable(),
  paymentDate: z.string().min(1),
  mode: z.enum(["CASH", "BANK", "UPI", "CARD", "OTHER"]),
  reference: z.string().trim().max(120).optional().nullable(),
  amount: moneyField,
  memo: z.string().trim().max(5000).optional().nullable(),
  bankAccountId: z.string().trim().min(1),
  allocations: z
    .array(
      z.object({
        billId: z.string().trim().min(1),
        amount: moneyField,
      }),
    )
    .min(1),
});

export const vendorCreditCreateSchema = z.object({
  vendorId: z.string().trim().min(1),
  creditNumber: z.string().trim().max(80).optional().nullable(),
  issueDate: z.string().min(1),
  amount: moneyField,
  reason: z.string().trim().max(2000).optional().nullable(),
  expenseAccountId: z.string().trim().min(1),
});

export const vendorCreditApplySchema = z.object({
  billId: z.string().trim().min(1),
  amount: moneyField,
});

const bankingAccountKindSchema = z.enum(["SAVINGS", "CURRENT", "CREDIT_CARD", "CASH"]);
const bankingAccountStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const bankingAccountCreateSchema = z.object({
  bankName: z.string().trim().min(1).max(200),
  accountName: z.string().trim().min(1).max(200),
  accountNumber: z.string().trim().min(1).max(64),
  routingOrIfsc: z.string().trim().max(32).optional().nullable(),
  currency: z.string().trim().length(3).default("INR"),
  kind: bankingAccountKindSchema,
  status: bankingAccountStatusSchema.optional(),
  openingBalance: moneyField.optional(),
  openingBalanceDate: z.string().optional().nullable(),
  chartAccountId: z.string().trim().optional().nullable(),
});

export const bankingAccountPatchSchema = bankingAccountCreateSchema.partial();

const bankingMappingModuleSchema = z.enum(["INVOICE", "BILL", "EXPENSE", "VENDOR_PAYMENT"]);

export const bankingReconcileSchema = z.object({
  bankingTransactionId: z.string().trim().min(1),
  matches: z
    .array(
      z.object({
        moduleType: bankingMappingModuleSchema,
        moduleId: z.string().trim().min(1),
        amount: moneyField,
        expenseAccountId: z.string().trim().optional().nullable(),
      }),
    )
    .min(1),
});

const bankingStatementColumnMapSchema = z
  .object({
    date: z.number().int().min(0).max(256),
    description: z.number().int().min(0).max(256),
    debit: z.number().int().min(0).max(256).optional(),
    credit: z.number().int().min(0).max(256).optional(),
    amount: z.number().int().min(0).max(256).optional(),
    balance: z.number().int().min(0).max(256).optional(),
    reference: z.number().int().min(0).max(256).optional(),
  })
  .refine((m) => m.amount != null || m.debit != null || m.credit != null, {
    message: "Column map must include amount or debit/credit",
  });

export const bankingStatementParseSchema = z
  .object({
    csvText: z.string().max(2_000_000).optional(),
    columnMap: bankingStatementColumnMapSchema.optional(),
    rawText: z.string().max(6_000_000).optional(),
    bankHint: z.string().max(40).optional(),
    table: z.array(z.array(z.string().max(800))).max(6000).optional(),
    headerRowIndex: z.number().int().min(0).max(500).optional(),
  })
  .superRefine((val, ctx) => {
    const csv = val.csvText?.trim().length ? val.csvText : undefined;
    const raw = val.rawText?.trim().length ? val.rawText : undefined;
    const tab = val.table?.length ? val.table : undefined;
    const n = [csv, raw, tab].filter(Boolean).length;
    if (n !== 1) {
      ctx.addIssue({ code: "custom", message: "Provide exactly one of csvText, rawText, or table" });
    }
    if (tab && val.headerRowIndex === undefined) {
      ctx.addIssue({ code: "custom", message: "headerRowIndex is required with table" });
    }
    if (tab && !val.columnMap) {
      ctx.addIssue({ code: "custom", message: "columnMap is required with table" });
    }
  });

export const bankingStatementImportSchema = z.object({
  bankingAccountId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(240),
  fileHash: z.string().trim().min(8).max(128),
  format: z.enum(["csv", "xlsx", "xls", "pdf", "image", "text"]),
  duplicateMode: z.enum(["skip", "include", "reject"]).optional().default("skip"),
  fileMime: z.string().trim().max(120).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  rows: z
    .array(
      z.object({
        txnDate: z.string().min(1),
        description: z.string().trim().min(1).max(2000),
        debit: moneyField,
        credit: moneyField,
        balance: moneyField.optional().nullable(),
        reference: z.string().trim().max(200).optional().nullable(),
      }),
    )
    .min(1)
    .max(5000),
});

const timeProjectBillingTypeSchema = z.enum(["FIXED_COST", "PROJECT_HOURS", "STAFF_HOURS"]);
const timeProjectStatusSchema = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]);

export const timeProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  customerId: z.string().trim().min(1),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  hourlyRate: moneyField.optional().default(0),
  billingType: timeProjectBillingTypeSchema.optional().default("PROJECT_HOURS"),
  budgetHours: moneyField.optional().nullable(),
  status: timeProjectStatusSchema.optional().default("ACTIVE"),
  progressPercent: z.number().int().min(0).max(100).optional().default(0),
  memberEmployeeIds: z.array(z.string().trim().min(1)).max(200).optional(),
});

export const timeProjectPatchSchema = timeProjectCreateSchema.partial();

const timeTaskStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]);
const timeTaskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const timeTaskCreateSchema = z.object({
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  assignedEmployeeId: z.string().trim().optional().nullable(),
  estimatedHours: moneyField.optional().nullable(),
  billable: z.boolean().optional().default(true),
  priority: timeTaskPrioritySchema.optional().default("MEDIUM"),
  status: timeTaskStatusSchema.optional().default("OPEN"),
  sortOrder: z.number().int().optional().default(0),
});

export const timeTaskPatchSchema = timeTaskCreateSchema.partial().omit({ projectId: true });

export const timeEntryManualSchema = z.object({
  employeeId: z.string().trim().min(1),
  workDate: z.string().min(1),
  projectId: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  hours: z.number().positive().max(24),
  billable: z.boolean().optional().default(true),
  notes: z.string().trim().max(2000).optional().nullable(),
  timesheetId: z.string().trim().optional().nullable(),
});

export const timeEntryPatchSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  billable: z.boolean().optional(),
  projectId: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  timesheetId: z.string().trim().optional().nullable(),
});

export const timeTimerStartSchema = z.object({
  employeeId: z.string().trim().min(1),
  projectId: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const timeTimerStopSchema = z.object({
  entryId: z.string().trim().optional(),
});

export const timeTimerPauseSchema = z.object({
  entryId: z.string().trim().optional(),
});

export const timeTimerResumeSchema = z.object({
  entryId: z.string().trim().min(1),
});

export const timesheetCreateSchema = z.object({
  employeeId: z.string().trim().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export const timesheetReviewSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().trim().max(2000).optional().nullable(),
});

export const timeInvoiceFromEntriesSchema = z.object({
  entryIds: z.array(z.string().trim().min(1)).min(1).max(500),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
});

const workTaskStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "WAITING_REVIEW", "COMPLETED", "CANCELLED"]);
const workTaskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const workTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10000).optional().nullable(),
  assignedEmployeeId: z.string().trim().optional().nullable(),
  timeProjectId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  vendorId: z.string().trim().optional().nullable(),
  priority: workTaskPrioritySchema.optional().default("MEDIUM"),
  status: workTaskStatusSchema.optional().default("OPEN"),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: moneyField.optional().nullable(),
  billable: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  recurrenceRule: z.string().trim().max(200).optional().nullable(),
  subtasks: z
    .array(z.object({ title: z.string().trim().min(1).max(300), sortOrder: z.number().int().optional() }))
    .max(50)
    .optional(),
});

export const workTaskPatchSchema = workTaskCreateSchema.partial();

export const workTaskStatusPatchSchema = z.object({
  status: workTaskStatusSchema,
});

export const workSubtaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  sortOrder: z.number().int().optional().default(0),
});

export const workSubtaskPatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(["OPEN", "COMPLETED"]).optional(),
  sortOrder: z.number().int().optional(),
});

export const workTaskCommentSchema = z.object({
  taskId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(5000),
});

export const workTaskTimerStartSchema = z.object({
  employeeId: z.string().trim().min(1),
  workTaskId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const workTaskTimerStopSchema = z.object({
  entryId: z.string().trim().optional(),
});
