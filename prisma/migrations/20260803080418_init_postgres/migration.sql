-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'OPEN', 'APPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('BUSINESS', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "GstTaxPreference" AS ENUM ('TAXABLE', 'NON_TAXABLE', 'EXEMPT', 'NIL_RATED');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('TALLY', 'ZOHO_BOOKS', 'QUICKBOOKS');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "ItemGstTaxMode" AS ENUM ('AUTO', 'INTRA', 'INTER');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('GOODS', 'SERVICE');

-- CreateEnum
CREATE TYPE "JournalPostingStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "JournalReferenceKind" AS ENUM ('INVOICE_ISSUE', 'PAYMENT_RECEIPT', 'CREDIT_NOTE', 'MANUAL', 'PURCHASE_EXPENSE', 'VENDOR_BILL', 'VENDOR_PAYMENT', 'VENDOR_CREDIT', 'PAYROLL_RUN', 'TALLY_IMPORT');

-- CreateEnum
CREATE TYPE "TallyMigrationStatus" AS ENUM ('PENDING', 'PARSING', 'IMPORTING_COA', 'IMPORTING_VOUCHERS', 'IMPORTING_INVENTORY', 'RECONCILING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK', 'UPI', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'BILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringInvoiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "SalaryAmountType" AS ENUM ('FLAT', 'PERCENT_OF_BASIC');

-- CreateEnum
CREATE TYPE "SalaryComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('FIFO', 'WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "VendorBillStatus" AS ENUM ('DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "EWayBillStatus" AS ENUM ('DRAFT', 'READY', 'GENERATED', 'IN_TRANSIT', 'EXPIRED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "EWayBillDocumentType" AS ENUM ('TAX_INVOICE', 'BILL_OF_SUPPLY', 'DELIVERY_CHALLAN', 'JOB_WORK_CHALLAN', 'STOCK_TRANSFER', 'PURCHASE_RETURN', 'EXPORT_SHIPMENT');

-- CreateEnum
CREATE TYPE "EWayTransportMode" AS ENUM ('ROAD', 'RAIL', 'AIR', 'SHIP');

-- CreateEnum
CREATE TYPE "EWayVehicleType" AS ENUM ('REGULAR', 'OVER_DIMENSIONAL_CARGO');

-- CreateEnum
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'DELIVERED', 'VOID');

-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "VendorCreditStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkSubtaskStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tallyGuid" TEXT,
    "tallyParentName" TEXT,
    "isTallyGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankingAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateHint" TEXT,
    "fileMime" TEXT,
    "fileSizeBytes" INTEGER,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "routingOrIfsc" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openingBalanceDate" TIMESTAMP(3),
    "chartAccountId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankingAccountId" TEXT NOT NULL,
    "statementImportId" TEXT,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balance" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'UNMAPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceFingerprint" TEXT,

    CONSTRAINT "BankingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingTransactionMapping" (
    "id" TEXT NOT NULL,
    "bankingTransactionId" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "amountApplied" DECIMAL(65,30) NOT NULL,
    "createdPaymentId" TEXT,
    "createdVendorPaymentId" TEXT,
    "createdExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankingTransactionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "logoUrl" TEXT,
    "billingStreet" TEXT,
    "billingStreet2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingCountry" TEXT NOT NULL DEFAULT 'IN',
    "gstin" TEXT,
    "pan" TEXT,
    "companyIdentifier" TEXT,
    "financialYearStartMonth" INTEGER NOT NULL DEFAULT 4,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "industry" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "websiteUrl" TEXT,
    "paymentAddressDifferent" BOOLEAN NOT NULL DEFAULT false,
    "paymentStreet" TEXT,
    "paymentStreet2" TEXT,
    "paymentCity" TEXT,
    "paymentState" TEXT,
    "paymentZip" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "smtpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "reportBasis" TEXT NOT NULL DEFAULT 'ACCRUAL',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "organizationLanguage" TEXT NOT NULL DEFAULT 'en',
    "communicationLanguages" TEXT NOT NULL DEFAULT 'en',
    "addressFormatNote" TEXT,
    "prefWeekStartsMonday" BOOLEAN NOT NULL DEFAULT true,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT true,
    "gstRegistrationType" TEXT,
    "gstBusinessLegalName" TEXT,
    "gstBusinessTradeName" TEXT,
    "gstRegisteredOn" TIMESTAMP(3),
    "gstReverseChargeSales" BOOLEAN NOT NULL DEFAULT false,
    "gstSezOverseasTrading" BOOLEAN NOT NULL DEFAULT false,
    "gstDigitalServicesExport" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "reason" TEXT,
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountApplied" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversalJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteApplication" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNoteApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL,
    "lineTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "formatLocale" TEXT NOT NULL DEFAULT 'en-IN',
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "exchangeRate" DECIMAL(65,30),
    "rateUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
    "salutation" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "displayName" TEXT NOT NULL,
    "gstin" TEXT,
    "email" TEXT,
    "workPhoneCountryCode" TEXT NOT NULL DEFAULT '+91',
    "workPhone" TEXT,
    "mobileCountryCode" TEXT NOT NULL DEFAULT '+91',
    "mobile" TEXT,
    "customerLanguage" TEXT NOT NULL DEFAULT 'en',
    "billingAttention" TEXT,
    "billingStreet" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingCountry" TEXT NOT NULL DEFAULT 'IN',
    "pan" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "accountsReceivableAccount" TEXT,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "openingBookValue" DECIMAL(65,30) NOT NULL,
    "closingBookValue" DECIMAL(65,30) NOT NULL,
    "journalEntryId" TEXT NOT NULL,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "exportFileNamePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateModuleMap" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,

    CONSTRAINT "DocumentTemplateModuleMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "dateOfJoining" TIMESTAMP(3),
    "salaryStructureId" TEXT,
    "bankAccountName" TEXT,
    "bankIfsc" TEXT,
    "bankAccountNo" TEXT,
    "pan" TEXT,
    "aadhaarLast4" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "category" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchaseCost" DECIMAL(65,30) NOT NULL,
    "salvageValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL,
    "wdvAnnualPercent" DECIMAL(65,30),
    "depreciationStartDate" TIMESTAMP(3) NOT NULL,
    "scheduleFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "assetAccountId" TEXT NOT NULL,
    "depreciationExpenseAccountId" TEXT NOT NULL,
    "accumulatedDepreciationAccountId" TEXT NOT NULL,
    "accumulatedDepreciation" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentBookValue" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "disposalType" TEXT,
    "disposalProceeds" DECIMAL(65,30),
    "disposalGainOrLoss" DECIMAL(65,30),
    "disposalCashAccountId" TEXT,
    "disposalJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstBillReconciliation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "portalInvoiceNo" TEXT,
    "notes" TEXT,

    CONSTRAINT "GstBillReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentialsEncrypted" TEXT,
    "configJson" TEXT,
    "mappingJson" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySettings" (
    "userId" TEXT NOT NULL,
    "valuationMethod" "ValuationMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',

    CONSTRAINT "InventorySettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InventoryUnit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "reference" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL(65,30),
    "baseTotal" DECIMAL(65,30),
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentLabel" TEXT NOT NULL DEFAULT 'Adjustment',
    "adjustmentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payableTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quoteId" TEXT,
    "documentTemplateId" TEXT,
    "recurringInvoiceId" TEXT,
    "issuanceJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "reference" TEXT,
    "challanDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanLine" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL,
    "lineTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryChallanLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL,
    "lineTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'GOODS',
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "salesDescription" TEXT,
    "salesRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "purchaseDescription" TEXT,
    "purchaseRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sellable" BOOLEAN NOT NULL DEFAULT true,
    "purchasable" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "inventoryUnitId" TEXT,
    "reorderLevel" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "gstTaxPreference" "GstTaxPreference" NOT NULL DEFAULT 'TAXABLE',
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "gstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "hsnCode" TEXT,
    "gstTaxMode" "ItemGstTaxMode" NOT NULL DEFAULT 'AUTO',
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemStock" (
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "ItemStock_pkey" PRIMARY KEY ("itemId","warehouseId")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "referenceKind" "JournalReferenceKind",
    "referenceId" TEXT,
    "postingStatus" "JournalPostingStatus" NOT NULL DEFAULT 'POSTED',
    "referenceNo" TEXT,
    "tallyVoucherKey" TEXT,
    "tallyVoucherType" TEXT,
    "tallyVoucherNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "originalName" TEXT,
    "rawText" TEXT,
    "extractedJson" TEXT,
    "fieldConfidenceJson" TEXT,
    "auditLogJson" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrVendorTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorGstin" TEXT,
    "vendorNameKey" TEXT NOT NULL,
    "layoutHintsJson" TEXT,
    "sampleTextPreview" TEXT,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrVendorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBillSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "valueThresholdInr" DECIMAL(65,30) NOT NULL DEFAULT 50000,
    "autoSuggestInterstate" BOOLEAN NOT NULL DEFAULT true,
    "autoSuggestOverThreshold" BOOLEAN NOT NULL DEFAULT true,
    "gspProvider" TEXT NOT NULL DEFAULT 'sandbox',
    "apiCredentialsEnc" TEXT,
    "sandboxMode" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EWayBillSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "transporterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EWayBillStatus" NOT NULL DEFAULT 'DRAFT',
    "documentType" "EWayBillDocumentType" NOT NULL DEFAULT 'TAX_INVOICE',
    "invoiceId" TEXT,
    "deliveryChallanId" TEXT,
    "purchaseReturnId" TEXT,
    "sourceDocumentNumber" TEXT NOT NULL,
    "sourceDocumentDate" TIMESTAMP(3) NOT NULL,
    "documentValue" DECIMAL(65,30) NOT NULL,
    "ewayBillNumber" TEXT,
    "generatedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "qrCodeData" TEXT,
    "apiAckNo" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierGstin" TEXT,
    "supplierAddress" TEXT,
    "supplierStateCode" TEXT,
    "supplierPincode" TEXT,
    "customerId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientGstin" TEXT,
    "recipientAddress" TEXT,
    "recipientStateCode" TEXT,
    "recipientPincode" TEXT,
    "transporterId" TEXT,
    "transporterName" TEXT,
    "transporterGstin" TEXT,
    "transportMode" "EWayTransportMode" NOT NULL DEFAULT 'ROAD',
    "vehicleNumber" TEXT,
    "vehicleType" "EWayVehicleType" NOT NULL DEFAULT 'REGULAR',
    "distanceKm" INTEGER,
    "placeOfSupply" TEXT,
    "supplyType" TEXT,
    "subSupplyType" TEXT,
    "transactionType" TEXT NOT NULL DEFAULT 'Regular',
    "errorMessage" TEXT,
    "lastApiResponseJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBillLine" (
    "id" TEXT NOT NULL,
    "ewayBillId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "taxableValue" DECIMAL(65,30) NOT NULL,
    "cgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cessRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EWayBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBillVehicleUpdate" (
    "id" TEXT NOT NULL,
    "ewayBillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "transportMode" "EWayTransportMode",
    "reason" TEXT,
    "updatedFrom" TEXT,
    "apiResponseJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EWayBillVehicleUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBillStatusHistory" (
    "id" TEXT NOT NULL,
    "ewayBillId" TEXT NOT NULL,
    "fromStatus" "EWayBillStatus",
    "toStatus" "EWayBillStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EWayBillStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBillApiLog" (
    "id" TEXT NOT NULL,
    "ewayBillId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestJson" TEXT,
    "responseJson" TEXT,
    "httpStatus" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EWayBillApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quotesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryChallanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recurringInvoiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "creditNoteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentLinksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "purchaseOrderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recurringExpenseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recurringBillsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "vendorCreditEnabled" BOOLEAN NOT NULL DEFAULT true,
    "manualJournalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recurringJournalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fixedAssetsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timeTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tasksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payrollEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inventoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warehousesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "batchTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "serialTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ocrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tallyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "zohoBooksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quickbooksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "exchangeRateFeedsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultPdfExportFilenamePattern" TEXT,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "memo" TEXT,
    "receiptJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "gross" DECIMAL(65,30) NOT NULL,
    "totalDeductions" DECIMAL(65,30) NOT NULL,
    "netPay" DECIMAL(65,30) NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerId" TEXT,
    "invoiceNumber" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "reference" TEXT,
    "poDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL(65,30),
    "baseTotal" DECIMAL(65,30),
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "deliveryCustomerId" TEXT,
    "deliverySnapshot" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "shipmentPreference" TEXT,
    "termsAndConditions" TEXT,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pdfTemplate" TEXT NOT NULL DEFAULT 'Standard Template',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT,
    "expenseAccountId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "reference" TEXT,
    "quoteDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "salesperson" TEXT,
    "projectName" TEXT,
    "subject" TEXT,
    "customerNotes" TEXT,
    "termsAndConditions" TEXT,
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountMode" TEXT NOT NULL DEFAULT 'PERCENT',
    "discountInput" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'TDS',
    "taxSelectLabel" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentLabel" TEXT NOT NULL DEFAULT 'Adjustment',
    "adjustmentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pdfTemplate" TEXT NOT NULL DEFAULT 'Spreadsheet Template',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expenseAccountId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL DEFAULT '',
    "frequency" "RecurringFrequency" NOT NULL,
    "repeatEvery" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "status" "RecurringInvoiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoEmail" BOOLEAN NOT NULL DEFAULT false,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoiceLine" (
    "id" TEXT NOT NULL,
    "recurringInvoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "rate" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecurringInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringVendorBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL DEFAULT '',
    "frequency" "RecurringFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "accountsPayableAccountId" TEXT,
    "notesInternal" TEXT,
    "memo" TEXT,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringVendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringVendorBillLine" (
    "id" TEXT NOT NULL,
    "recurringBillId" TEXT NOT NULL,
    "itemId" TEXT,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "rate" DECIMAL(65,30) NOT NULL,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecurringVendorBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL,
    "amountType" "SalaryAmountType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "percentOfBasic" DECIMAL(65,30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityDelta" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallyMigrationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "status" "TallyMigrationStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" TEXT NOT NULL DEFAULT 'xml_upload',
    "fileName" TEXT,
    "phasesJson" TEXT,
    "statsJson" TEXT,
    "reconcileJson" TEXT,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallyMigrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallyMigrationLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "phase" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TallyMigrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallyEntityMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "entityType" TEXT NOT NULL,
    "tallyKey" TEXT NOT NULL,
    "tallyGuid" TEXT,
    "erpModel" TEXT NOT NULL,
    "erpId" TEXT NOT NULL,
    "parentTallyKey" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallyEntityMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallyMigrationSnapshot" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "parsedJson" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TallyMigrationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appRoleId" TEXT,
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "workTaskId" TEXT,
    "timesheetId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "hourlyRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "billingType" TEXT NOT NULL DEFAULT 'PROJECT_HOURS',
    "budgetHours" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "TimeProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "estimatedHours" DECIMAL(65,30),
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "reviewNotes" TEXT,
    "payrollSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '["*"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocumentTemplateDefault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "UserDocumentTemplateDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "salutation" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "workPhoneCountryCode" TEXT NOT NULL DEFAULT '+91',
    "workPhone" TEXT,
    "mobileCountryCode" TEXT NOT NULL DEFAULT '+91',
    "mobile" TEXT,
    "vendorLanguage" TEXT NOT NULL DEFAULT 'en',
    "gstin" TEXT,
    "billingAttention" TEXT,
    "billingStreet" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingCountry" TEXT NOT NULL DEFAULT 'IN',
    "pan" TEXT,
    "msmeRegistered" BOOLEAN NOT NULL DEFAULT false,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "accountsPayableAccountId" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "tdsAccountId" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "reference" TEXT,
    "orderNumber" TEXT,
    "subject" TEXT,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "accountsPayableAccountId" TEXT,
    "notesInternal" TEXT,
    "status" "VendorBillStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL(65,30),
    "baseTotal" DECIMAL(65,30),
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pdfTemplate" TEXT NOT NULL DEFAULT 'Standard Template',
    "purchaseOrderId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "itemId" TEXT,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL,
    "lineTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VendorBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "reference" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorBillId" TEXT,
    "reason" TEXT,
    "subTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNet" DECIMAL(65,30) NOT NULL,
    "lineTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "amountApplied" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" "VendorCreditStatus" NOT NULL DEFAULT 'OPEN',
    "expenseAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCreditApplication" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "VendorCreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "memo" TEXT,
    "bankAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "VendorPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedEmployeeId" TEXT,
    "timeProjectId" TEXT,
    "customerId" TEXT,
    "vendorId" TEXT,
    "priority" "WorkTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'OPEN',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimatedHours" DECIMAL(65,30),
    "actualSeconds" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "recurrenceRule" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSubtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkSubtaskStatus" NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE INDEX "Account_userId_tallyGuid_idx" ON "Account"("userId", "tallyGuid");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_code_key" ON "Account"("userId", "code");

-- CreateIndex
CREATE INDEX "AppRole_userId_idx" ON "AppRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_userId_slug_key" ON "AppRole"("userId", "slug");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BankStatementImport_userId_idx" ON "BankStatementImport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementImport_bankingAccountId_fileHash_key" ON "BankStatementImport"("bankingAccountId", "fileHash");

-- CreateIndex
CREATE INDEX "BankingAccount_chartAccountId_idx" ON "BankingAccount"("chartAccountId");

-- CreateIndex
CREATE INDEX "BankingAccount_userId_idx" ON "BankingAccount"("userId");

-- CreateIndex
CREATE INDEX "BankingTransaction_bankingAccountId_sourceFingerprint_idx" ON "BankingTransaction"("bankingAccountId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "BankingTransaction_userId_status_idx" ON "BankingTransaction"("userId", "status");

-- CreateIndex
CREATE INDEX "BankingTransaction_bankingAccountId_txnDate_idx" ON "BankingTransaction"("bankingAccountId", "txnDate");

-- CreateIndex
CREATE INDEX "BankingTransactionMapping_moduleType_moduleId_idx" ON "BankingTransactionMapping"("moduleType", "moduleId");

-- CreateIndex
CREATE INDEX "BankingTransactionMapping_bankingTransactionId_idx" ON "BankingTransactionMapping"("bankingTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_userId_key" ON "CompanyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_reversalJournalId_key" ON "CreditNote"("reversalJournalId");

-- CreateIndex
CREATE INDEX "CreditNote_userId_idx" ON "CreditNote"("userId");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_userId_creditNumber_key" ON "CreditNote"("userId", "creditNumber");

-- CreateIndex
CREATE INDEX "CreditNoteApplication_creditNoteId_idx" ON "CreditNoteApplication"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditNoteApplication_invoiceId_idx" ON "CreditNoteApplication"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "Currency_userId_isActive_idx" ON "Currency"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Currency_userId_idx" ON "Currency"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_userId_code_key" ON "Currency"("userId", "code");

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_userId_displayName_idx" ON "Customer"("userId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_journalEntryId_key" ON "DepreciationEntry"("journalEntryId");

-- CreateIndex
CREATE INDEX "DepreciationEntry_assetId_idx" ON "DepreciationEntry"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_assetId_periodStart_key" ON "DepreciationEntry"("assetId", "periodStart");

-- CreateIndex
CREATE INDEX "DocumentTemplate_userId_type_idx" ON "DocumentTemplate"("userId", "type");

-- CreateIndex
CREATE INDEX "DocumentTemplate_userId_type_isDefault_idx" ON "DocumentTemplate"("userId", "type", "isDefault");

-- CreateIndex
CREATE INDEX "DocumentTemplateModuleMap_moduleName_idx" ON "DocumentTemplateModuleMap"("moduleName");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateModuleMap_templateId_moduleName_key" ON "DocumentTemplateModuleMap"("templateId", "moduleName");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_employeeNumber_key" ON "Employee"("userId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_disposalJournalId_key" ON "FixedAsset"("disposalJournalId");

-- CreateIndex
CREATE INDEX "FixedAsset_userId_status_idx" ON "FixedAsset"("userId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_userId_idx" ON "FixedAsset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_userId_assetCode_key" ON "FixedAsset"("userId", "assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "GstBillReconciliation_billId_key" ON "GstBillReconciliation"("billId");

-- CreateIndex
CREATE INDEX "GstBillReconciliation_userId_monthKey_idx" ON "GstBillReconciliation"("userId", "monthKey");

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_type_key" ON "Integration"("userId", "type");

-- CreateIndex
CREATE INDEX "InventoryUnit_userId_idx" ON "InventoryUnit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryUnit_userId_name_key" ON "InventoryUnit"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_issuanceJournalId_key" ON "Invoice"("issuanceJournalId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_recurringInvoiceId_idx" ON "Invoice"("recurringInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_documentTemplateId_idx" ON "Invoice"("documentTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_invoiceNumber_key" ON "Invoice"("userId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallan_userId_idx" ON "DeliveryChallan"("userId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_customerId_idx" ON "DeliveryChallan"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_status_idx" ON "DeliveryChallan"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_invoiceId_idx" ON "DeliveryChallan"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_userId_challanNumber_key" ON "DeliveryChallan"("userId", "challanNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_challanId_idx" ON "DeliveryChallanLine"("challanId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item_userId_sku_idx" ON "Item"("userId", "sku");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_inventoryUnitId_idx" ON "Item"("inventoryUnitId");

-- CreateIndex
CREATE INDEX "ItemCategory_userId_idx" ON "ItemCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_userId_name_key" ON "ItemCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "ItemStock_warehouseId_idx" ON "ItemStock"("warehouseId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_entryDate_idx" ON "JournalEntry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_postingStatus_idx" ON "JournalEntry"("userId", "postingStatus");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_tallyVoucherKey_idx" ON "JournalEntry"("userId", "tallyVoucherKey");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "OcrDocument_userId_idx" ON "OcrDocument"("userId");

-- CreateIndex
CREATE INDEX "OcrDocument_userId_status_idx" ON "OcrDocument"("userId", "status");

-- CreateIndex
CREATE INDEX "OcrDocument_userId_createdAt_idx" ON "OcrDocument"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrVendorTemplate_userId_idx" ON "OcrVendorTemplate"("userId");

-- CreateIndex
CREATE INDEX "OcrVendorTemplate_userId_vendorGstin_idx" ON "OcrVendorTemplate"("userId", "vendorGstin");

-- CreateIndex
CREATE INDEX "OcrVendorTemplate_userId_vendorNameKey_idx" ON "OcrVendorTemplate"("userId", "vendorNameKey");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBillSettings_userId_key" ON "EWayBillSettings"("userId");

-- CreateIndex
CREATE INDEX "EWayBillSettings_userId_idx" ON "EWayBillSettings"("userId");

-- CreateIndex
CREATE INDEX "Transporter_userId_idx" ON "Transporter"("userId");

-- CreateIndex
CREATE INDEX "Transporter_userId_name_idx" ON "Transporter"("userId", "name");

-- CreateIndex
CREATE INDEX "EWayBill_userId_status_idx" ON "EWayBill"("userId", "status");

-- CreateIndex
CREATE INDEX "EWayBill_userId_createdAt_idx" ON "EWayBill"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EWayBill_userId_sourceDocumentNumber_idx" ON "EWayBill"("userId", "sourceDocumentNumber");

-- CreateIndex
CREATE INDEX "EWayBill_invoiceId_idx" ON "EWayBill"("invoiceId");

-- CreateIndex
CREATE INDEX "EWayBill_deliveryChallanId_idx" ON "EWayBill"("deliveryChallanId");

-- CreateIndex
CREATE INDEX "EWayBill_purchaseReturnId_idx" ON "EWayBill"("purchaseReturnId");

-- CreateIndex
CREATE INDEX "EWayBill_customerId_idx" ON "EWayBill"("customerId");

-- CreateIndex
CREATE INDEX "EWayBill_vehicleNumber_idx" ON "EWayBill"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBill_userId_ewayBillNumber_key" ON "EWayBill"("userId", "ewayBillNumber");

-- CreateIndex
CREATE INDEX "EWayBillLine_ewayBillId_idx" ON "EWayBillLine"("ewayBillId");

-- CreateIndex
CREATE INDEX "EWayBillVehicleUpdate_ewayBillId_idx" ON "EWayBillVehicleUpdate"("ewayBillId");

-- CreateIndex
CREATE INDEX "EWayBillVehicleUpdate_userId_createdAt_idx" ON "EWayBillVehicleUpdate"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EWayBillStatusHistory_ewayBillId_idx" ON "EWayBillStatusHistory"("ewayBillId");

-- CreateIndex
CREATE INDEX "EWayBillApiLog_userId_createdAt_idx" ON "EWayBillApiLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EWayBillApiLog_ewayBillId_idx" ON "EWayBillApiLog"("ewayBillId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_userId_key" ON "OrganizationSettings"("userId");

-- CreateIndex
CREATE INDEX "OrganizationSettings_userId_idx" ON "OrganizationSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptJournalId_key" ON "Payment"("receiptJournalId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_paymentNumber_key" ON "Payment"("userId", "paymentNumber");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_journalEntryId_key" ON "PayrollRun"("journalEntryId");

-- CreateIndex
CREATE INDEX "PayrollRun_userId_idx" ON "PayrollRun"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_userId_yearMonth_key" ON "PayrollRun"("userId", "yearMonth");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseExpense_journalEntryId_key" ON "PurchaseExpense"("journalEntryId");

-- CreateIndex
CREATE INDEX "PurchaseExpense_userId_idx" ON "PurchaseExpense"("userId");

-- CreateIndex
CREATE INDEX "PurchaseExpense_userId_expenseDate_idx" ON "PurchaseExpense"("userId", "expenseDate");

-- CreateIndex
CREATE INDEX "PurchaseExpense_vendorId_idx" ON "PurchaseExpense"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseExpense_customerId_idx" ON "PurchaseExpense"("customerId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_deliveryCustomerId_idx" ON "PurchaseOrder"("deliveryCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_userId_poNumber_key" ON "PurchaseOrder"("userId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_expenseAccountId_idx" ON "PurchaseOrderLine"("expenseAccountId");

-- CreateIndex
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_userId_quoteNumber_key" ON "Quote"("userId", "quoteNumber");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");

-- CreateIndex
CREATE INDEX "RecurringExpense_vendorId_idx" ON "RecurringExpense"("vendorId");

-- CreateIndex
CREATE INDEX "RecurringExpense_customerId_idx" ON "RecurringExpense"("customerId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_userId_idx" ON "RecurringInvoice"("userId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_customerId_idx" ON "RecurringInvoice"("customerId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_nextRunDate_idx" ON "RecurringInvoice"("nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringInvoice_status_idx" ON "RecurringInvoice"("status");

-- CreateIndex
CREATE INDEX "RecurringInvoiceLine_recurringInvoiceId_idx" ON "RecurringInvoiceLine"("recurringInvoiceId");

-- CreateIndex
CREATE INDEX "RecurringInvoiceLine_itemId_idx" ON "RecurringInvoiceLine"("itemId");

-- CreateIndex
CREATE INDEX "RecurringVendorBill_userId_idx" ON "RecurringVendorBill"("userId");

-- CreateIndex
CREATE INDEX "RecurringVendorBill_vendorId_idx" ON "RecurringVendorBill"("vendorId");

-- CreateIndex
CREATE INDEX "RecurringVendorBill_accountsPayableAccountId_idx" ON "RecurringVendorBill"("accountsPayableAccountId");

-- CreateIndex
CREATE INDEX "RecurringVendorBillLine_recurringBillId_idx" ON "RecurringVendorBillLine"("recurringBillId");

-- CreateIndex
CREATE INDEX "RecurringVendorBillLine_itemId_idx" ON "RecurringVendorBillLine"("itemId");

-- CreateIndex
CREATE INDEX "RecurringVendorBillLine_customerId_idx" ON "RecurringVendorBillLine"("customerId");

-- CreateIndex
CREATE INDEX "SalaryComponent_structureId_idx" ON "SalaryComponent"("structureId");

-- CreateIndex
CREATE INDEX "SalaryStructure_userId_idx" ON "SalaryStructure"("userId");

-- CreateIndex
CREATE INDEX "StockAdjustment_userId_idx" ON "StockAdjustment"("userId");

-- CreateIndex
CREATE INDEX "StockAdjustment_itemId_idx" ON "StockAdjustment"("itemId");

-- CreateIndex
CREATE INDEX "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId");

-- CreateIndex
CREATE INDEX "SyncLog_integrationId_idx" ON "SyncLog"("integrationId");

-- CreateIndex
CREATE INDEX "SyncLog_integrationId_syncedAt_idx" ON "SyncLog"("integrationId", "syncedAt");

-- CreateIndex
CREATE INDEX "TallyMigrationJob_userId_createdAt_idx" ON "TallyMigrationJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TallyMigrationJob_integrationId_idx" ON "TallyMigrationJob"("integrationId");

-- CreateIndex
CREATE INDEX "TallyMigrationLog_jobId_createdAt_idx" ON "TallyMigrationLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "TallyMigrationLog_jobId_level_idx" ON "TallyMigrationLog"("jobId", "level");

-- CreateIndex
CREATE INDEX "TallyEntityMap_userId_entityType_idx" ON "TallyEntityMap"("userId", "entityType");

-- CreateIndex
CREATE INDEX "TallyEntityMap_userId_tallyGuid_idx" ON "TallyEntityMap"("userId", "tallyGuid");

-- CreateIndex
CREATE INDEX "TallyEntityMap_jobId_idx" ON "TallyEntityMap"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "TallyEntityMap_userId_entityType_tallyKey_key" ON "TallyEntityMap"("userId", "entityType", "tallyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TallyMigrationSnapshot_jobId_key" ON "TallyMigrationSnapshot"("jobId");

-- CreateIndex
CREATE INDEX "TeamMember_ownerUserId_idx" ON "TeamMember"("ownerUserId");

-- CreateIndex
CREATE INDEX "TimeEntry_invoiceId_idx" ON "TimeEntry"("invoiceId");

-- CreateIndex
CREATE INDEX "TimeEntry_workTaskId_idx" ON "TimeEntry"("workTaskId");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimeEntry_timesheetId_idx" ON "TimeEntry"("timesheetId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_workDate_idx" ON "TimeEntry"("userId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_employeeId_idx" ON "TimeEntry"("userId", "employeeId");

-- CreateIndex
CREATE INDEX "TimeProject_customerId_idx" ON "TimeProject"("customerId");

-- CreateIndex
CREATE INDEX "TimeProject_userId_idx" ON "TimeProject"("userId");

-- CreateIndex
CREATE INDEX "TimeProjectMember_employeeId_idx" ON "TimeProjectMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeProjectMember_projectId_employeeId_key" ON "TimeProjectMember"("projectId", "employeeId");

-- CreateIndex
CREATE INDEX "TimeTask_assignedEmployeeId_idx" ON "TimeTask"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "TimeTask_projectId_idx" ON "TimeTask"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_userId_employeeId_idx" ON "Timesheet"("userId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserDocumentTemplateDefault_templateId_idx" ON "UserDocumentTemplateDefault"("templateId");

-- CreateIndex
CREATE INDEX "UserDocumentTemplateDefault_userId_idx" ON "UserDocumentTemplateDefault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDocumentTemplateDefault_userId_moduleName_key" ON "UserDocumentTemplateDefault"("userId", "moduleName");

-- CreateIndex
CREATE INDEX "Vendor_userId_idx" ON "Vendor"("userId");

-- CreateIndex
CREATE INDEX "Vendor_userId_displayName_idx" ON "Vendor"("userId", "displayName");

-- CreateIndex
CREATE INDEX "Vendor_accountsPayableAccountId_idx" ON "Vendor"("accountsPayableAccountId");

-- CreateIndex
CREATE INDEX "Vendor_tdsAccountId_idx" ON "Vendor"("tdsAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_journalEntryId_key" ON "VendorBill"("journalEntryId");

-- CreateIndex
CREATE INDEX "VendorBill_userId_idx" ON "VendorBill"("userId");

-- CreateIndex
CREATE INDEX "VendorBill_vendorId_idx" ON "VendorBill"("vendorId");

-- CreateIndex
CREATE INDEX "VendorBill_status_idx" ON "VendorBill"("status");

-- CreateIndex
CREATE INDEX "VendorBill_accountsPayableAccountId_idx" ON "VendorBill"("accountsPayableAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_userId_billNumber_key" ON "VendorBill"("userId", "billNumber");

-- CreateIndex
CREATE INDEX "VendorBillLine_billId_idx" ON "VendorBillLine"("billId");

-- CreateIndex
CREATE INDEX "VendorBillLine_customerId_idx" ON "VendorBillLine"("customerId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_userId_idx" ON "PurchaseReturn"("userId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_vendorId_idx" ON "PurchaseReturn"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_status_idx" ON "PurchaseReturn"("status");

-- CreateIndex
CREATE INDEX "PurchaseReturn_vendorBillId_idx" ON "PurchaseReturn"("vendorBillId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_userId_returnNumber_key" ON "PurchaseReturn"("userId", "returnNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_returnId_idx" ON "PurchaseReturnLine"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCredit_journalEntryId_key" ON "VendorCredit"("journalEntryId");

-- CreateIndex
CREATE INDEX "VendorCredit_userId_idx" ON "VendorCredit"("userId");

-- CreateIndex
CREATE INDEX "VendorCredit_vendorId_idx" ON "VendorCredit"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCredit_userId_creditNumber_key" ON "VendorCredit"("userId", "creditNumber");

-- CreateIndex
CREATE INDEX "VendorCreditApplication_creditId_idx" ON "VendorCreditApplication"("creditId");

-- CreateIndex
CREATE INDEX "VendorCreditApplication_billId_idx" ON "VendorCreditApplication"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_journalEntryId_key" ON "VendorPayment"("journalEntryId");

-- CreateIndex
CREATE INDEX "VendorPayment_userId_idx" ON "VendorPayment"("userId");

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_idx" ON "VendorPayment"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_userId_paymentNumber_key" ON "VendorPayment"("userId", "paymentNumber");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_paymentId_idx" ON "VendorPaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_billId_idx" ON "VendorPaymentAllocation"("billId");

-- CreateIndex
CREATE INDEX "Warehouse_userId_idx" ON "Warehouse"("userId");

-- CreateIndex
CREATE INDEX "WorkTask_userId_idx" ON "WorkTask"("userId");

-- CreateIndex
CREATE INDEX "WorkTask_userId_status_idx" ON "WorkTask"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkTask_userId_assignedEmployeeId_idx" ON "WorkTask"("userId", "assignedEmployeeId");

-- CreateIndex
CREATE INDEX "WorkTask_userId_dueDate_idx" ON "WorkTask"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "WorkTask_timeProjectId_idx" ON "WorkTask"("timeProjectId");

-- CreateIndex
CREATE INDEX "WorkTask_customerId_idx" ON "WorkTask"("customerId");

-- CreateIndex
CREATE INDEX "WorkTask_vendorId_idx" ON "WorkTask"("vendorId");

-- CreateIndex
CREATE INDEX "WorkSubtask_taskId_idx" ON "WorkSubtask"("taskId");

-- CreateIndex
CREATE INDEX "WorkTaskComment_taskId_idx" ON "WorkTaskComment"("taskId");

-- CreateIndex
CREATE INDEX "WorkTaskAttachment_taskId_idx" ON "WorkTaskAttachment"("taskId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRole" ADD CONSTRAINT "AppRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_bankingAccountId_fkey" FOREIGN KEY ("bankingAccountId") REFERENCES "BankingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingAccount" ADD CONSTRAINT "BankingAccount_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingAccount" ADD CONSTRAINT "BankingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingTransaction" ADD CONSTRAINT "BankingTransaction_statementImportId_fkey" FOREIGN KEY ("statementImportId") REFERENCES "BankStatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingTransaction" ADD CONSTRAINT "BankingTransaction_bankingAccountId_fkey" FOREIGN KEY ("bankingAccountId") REFERENCES "BankingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingTransactionMapping" ADD CONSTRAINT "BankingTransactionMapping_bankingTransactionId_fkey" FOREIGN KEY ("bankingTransactionId") REFERENCES "BankingTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_reversalJournalId_fkey" FOREIGN KEY ("reversalJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateModuleMap" ADD CONSTRAINT "DocumentTemplateModuleMap_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_disposalJournalId_fkey" FOREIGN KEY ("disposalJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_disposalCashAccountId_fkey" FOREIGN KEY ("disposalCashAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_accumulatedDepreciationAccountId_fkey" FOREIGN KEY ("accumulatedDepreciationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_depreciationExpenseAccountId_fkey" FOREIGN KEY ("depreciationExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstBillReconciliation" ADD CONSTRAINT "GstBillReconciliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstBillReconciliation" ADD CONSTRAINT "GstBillReconciliation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuanceJournalId_fkey" FOREIGN KEY ("issuanceJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "InventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStock" ADD CONSTRAINT "ItemStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStock" ADD CONSTRAINT "ItemStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrVendorTemplate" ADD CONSTRAINT "OcrVendorTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBillSettings" ADD CONSTRAINT "EWayBillSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transporter" ADD CONSTRAINT "Transporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBillLine" ADD CONSTRAINT "EWayBillLine_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBillVehicleUpdate" ADD CONSTRAINT "EWayBillVehicleUpdate_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBillStatusHistory" ADD CONSTRAINT "EWayBillStatusHistory_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBillApiLog" ADD CONSTRAINT "EWayBillApiLog_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptJournalId_fkey" FOREIGN KEY ("receiptJournalId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpense" ADD CONSTRAINT "PurchaseExpense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_deliveryCustomerId_fkey" FOREIGN KEY ("deliveryCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoiceLine" ADD CONSTRAINT "RecurringInvoiceLine_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoiceLine" ADD CONSTRAINT "RecurringInvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBill" ADD CONSTRAINT "RecurringVendorBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBill" ADD CONSTRAINT "RecurringVendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBill" ADD CONSTRAINT "RecurringVendorBill_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBillLine" ADD CONSTRAINT "RecurringVendorBillLine_recurringBillId_fkey" FOREIGN KEY ("recurringBillId") REFERENCES "RecurringVendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBillLine" ADD CONSTRAINT "RecurringVendorBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBillLine" ADD CONSTRAINT "RecurringVendorBillLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringVendorBillLine" ADD CONSTRAINT "RecurringVendorBillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyMigrationJob" ADD CONSTRAINT "TallyMigrationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyMigrationJob" ADD CONSTRAINT "TallyMigrationJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyMigrationLog" ADD CONSTRAINT "TallyMigrationLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyEntityMap" ADD CONSTRAINT "TallyEntityMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyEntityMap" ADD CONSTRAINT "TallyEntityMap_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallyMigrationSnapshot" ADD CONSTRAINT "TallyMigrationSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_appRoleId_fkey" FOREIGN KEY ("appRoleId") REFERENCES "AppRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TimeTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_workTaskId_fkey" FOREIGN KEY ("workTaskId") REFERENCES "WorkTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimeProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeProject" ADD CONSTRAINT "TimeProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeProject" ADD CONSTRAINT "TimeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeProjectMember" ADD CONSTRAINT "TimeProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeProjectMember" ADD CONSTRAINT "TimeProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTask" ADD CONSTRAINT "TimeTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTask" ADD CONSTRAINT "TimeTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocumentTemplateDefault" ADD CONSTRAINT "UserDocumentTemplateDefault_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocumentTemplateDefault" ADD CONSTRAINT "UserDocumentTemplateDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tdsAccountId_fkey" FOREIGN KEY ("tdsAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCredit" ADD CONSTRAINT "VendorCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCredit" ADD CONSTRAINT "VendorCredit_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCredit" ADD CONSTRAINT "VendorCredit_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCredit" ADD CONSTRAINT "VendorCredit_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCreditApplication" ADD CONSTRAINT "VendorCreditApplication_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "VendorCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCreditApplication" ADD CONSTRAINT "VendorCreditApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "VendorPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_timeProjectId_fkey" FOREIGN KEY ("timeProjectId") REFERENCES "TimeProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubtask" ADD CONSTRAINT "WorkSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskComment" ADD CONSTRAINT "WorkTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskComment" ADD CONSTRAINT "WorkTaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskAttachment" ADD CONSTRAINT "WorkTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskAttachment" ADD CONSTRAINT "WorkTaskAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
