-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VendorBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "reference" TEXT,
    "orderNumber" TEXT,
    "subject" TEXT,
    "billDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "accountsPayableAccountId" TEXT,
    "notesInternal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subTotal" DECIMAL NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL NOT NULL DEFAULT 0,
    "pdfTemplate" TEXT NOT NULL DEFAULT 'Standard Template',
    "purchaseOrderId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorBill_accountsPayableAccountId_fkey" FOREIGN KEY ("accountsPayableAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VendorBill" ("billDate", "billNumber", "createdAt", "currency", "dueDate", "id", "journalEntryId", "purchaseOrderId", "reference", "status", "subTotal", "taxTotal", "total", "updatedAt", "userId", "vendorId") SELECT "billDate", "billNumber", "createdAt", "currency", "dueDate", "id", "journalEntryId", "purchaseOrderId", "reference", "status", "subTotal", "taxTotal", "total", "updatedAt", "userId", "vendorId" FROM "VendorBill";
DROP TABLE "VendorBill";
ALTER TABLE "new_VendorBill" RENAME TO "VendorBill";
CREATE UNIQUE INDEX "VendorBill_journalEntryId_key" ON "VendorBill"("journalEntryId");
CREATE INDEX "VendorBill_userId_idx" ON "VendorBill"("userId");
CREATE INDEX "VendorBill_vendorId_idx" ON "VendorBill"("vendorId");
CREATE INDEX "VendorBill_status_idx" ON "VendorBill"("status");
CREATE INDEX "VendorBill_accountsPayableAccountId_idx" ON "VendorBill"("accountsPayableAccountId");
CREATE UNIQUE INDEX "VendorBill_userId_billNumber_key" ON "VendorBill"("userId", "billNumber");
CREATE TABLE "new_VendorBillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "itemId" TEXT,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "discountPercent" DECIMAL NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL NOT NULL DEFAULT 0,
    "lineNet" DECIMAL NOT NULL,
    "lineTax" DECIMAL NOT NULL,
    "lineTotal" DECIMAL NOT NULL,
    "expenseAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VendorBillLine" ("billId", "description", "expenseAccountId", "id", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent") SELECT "billId", "description", "expenseAccountId", "id", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent" FROM "VendorBillLine";
DROP TABLE "VendorBillLine";
ALTER TABLE "new_VendorBillLine" RENAME TO "VendorBillLine";
CREATE INDEX "VendorBillLine_billId_idx" ON "VendorBillLine"("billId");
CREATE INDEX "VendorBillLine_customerId_idx" ON "VendorBillLine"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
