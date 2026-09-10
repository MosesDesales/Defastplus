-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "customerType" TEXT NOT NULL DEFAULT 'BUSINESS',
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
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_userId_displayName_idx" ON "Customer"("userId", "displayName");
