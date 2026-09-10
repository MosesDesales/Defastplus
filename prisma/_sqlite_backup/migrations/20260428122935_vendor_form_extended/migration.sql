-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "accountsPayableAccountId" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "tdsAccountId" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vendor_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vendor_tdsAccountId_fkey" FOREIGN KEY ("tdsAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Vendor" ("billingCity", "billingCountry", "billingState", "billingStreet", "billingZip", "companyName", "createdAt", "currency", "displayName", "email", "gstin", "id", "isActive", "notes", "openingBalance", "phone", "updatedAt", "userId") SELECT "billingCity", "billingCountry", "billingState", "billingStreet", "billingZip", "companyName", "createdAt", "currency", "displayName", "email", "gstin", "id", "isActive", "notes", "openingBalance", "phone", "updatedAt", "userId" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
CREATE INDEX "Vendor_userId_idx" ON "Vendor"("userId");
CREATE INDEX "Vendor_userId_displayName_idx" ON "Vendor"("userId", "displayName");
CREATE INDEX "Vendor_accountsPayableAccountId_idx" ON "Vendor"("accountsPayableAccountId");
CREATE INDEX "Vendor_tdsAccountId_idx" ON "Vendor"("tdsAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
