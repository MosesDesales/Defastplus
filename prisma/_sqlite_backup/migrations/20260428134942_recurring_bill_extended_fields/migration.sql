-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringVendorBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "nextRunDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "accountsPayableAccountId" TEXT,
    "notesInternal" TEXT,
    "memo" TEXT,
    "discountPercent" DECIMAL NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL NOT NULL DEFAULT 0,
    "lastGeneratedAt" DATETIME,
    CONSTRAINT "RecurringVendorBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringVendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringVendorBill_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecurringVendorBill" ("endDate", "frequency", "id", "isActive", "lastGeneratedAt", "memo", "nextRunDate", "startDate", "userId", "vendorId") SELECT "endDate", "frequency", "id", "isActive", "lastGeneratedAt", "memo", "nextRunDate", "startDate", "userId", "vendorId" FROM "RecurringVendorBill";
DROP TABLE "RecurringVendorBill";
ALTER TABLE "new_RecurringVendorBill" RENAME TO "RecurringVendorBill";
CREATE INDEX "RecurringVendorBill_userId_idx" ON "RecurringVendorBill"("userId");
CREATE INDEX "RecurringVendorBill_vendorId_idx" ON "RecurringVendorBill"("vendorId");
CREATE INDEX "RecurringVendorBill_accountsPayableAccountId_idx" ON "RecurringVendorBill"("accountsPayableAccountId");
CREATE TABLE "new_RecurringVendorBillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurringBillId" TEXT NOT NULL,
    "itemId" TEXT,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 1,
    "rate" DECIMAL NOT NULL,
    "discountPercent" DECIMAL NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RecurringVendorBillLine_recurringBillId_fkey" FOREIGN KEY ("recurringBillId") REFERENCES "RecurringVendorBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringVendorBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringVendorBillLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringVendorBillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecurringVendorBillLine" ("description", "expenseAccountId", "id", "quantity", "rate", "recurringBillId", "sortOrder", "taxPercent") SELECT "description", "expenseAccountId", "id", "quantity", "rate", "recurringBillId", "sortOrder", "taxPercent" FROM "RecurringVendorBillLine";
DROP TABLE "RecurringVendorBillLine";
ALTER TABLE "new_RecurringVendorBillLine" RENAME TO "RecurringVendorBillLine";
CREATE INDEX "RecurringVendorBillLine_recurringBillId_idx" ON "RecurringVendorBillLine"("recurringBillId");
CREATE INDEX "RecurringVendorBillLine_itemId_idx" ON "RecurringVendorBillLine"("itemId");
CREATE INDEX "RecurringVendorBillLine_customerId_idx" ON "RecurringVendorBillLine"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
