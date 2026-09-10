-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "reference" TEXT,
    "poDate" DATETIME NOT NULL,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subTotal" DECIMAL NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "deliveryCustomerId" TEXT,
    "deliverySnapshot" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'DUE_ON_RECEIPT',
    "shipmentPreference" TEXT,
    "termsAndConditions" TEXT,
    "discountPercent" DECIMAL NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL NOT NULL DEFAULT 0,
    "withholdingType" TEXT NOT NULL DEFAULT 'NONE',
    "withholdingAmount" DECIMAL NOT NULL DEFAULT 0,
    "pdfTemplate" TEXT NOT NULL DEFAULT 'Standard Template',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_deliveryCustomerId_fkey" FOREIGN KEY ("deliveryCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("createdAt", "expectedDate", "id", "memo", "poDate", "poNumber", "reference", "status", "subTotal", "taxTotal", "total", "updatedAt", "userId", "vendorId") SELECT "createdAt", "expectedDate", "id", "memo", "poDate", "poNumber", "reference", "status", "subTotal", "taxTotal", "total", "updatedAt", "userId", "vendorId" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE INDEX "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");
CREATE INDEX "PurchaseOrder_deliveryCustomerId_idx" ON "PurchaseOrder"("deliveryCustomerId");
CREATE UNIQUE INDEX "PurchaseOrder_userId_poNumber_key" ON "PurchaseOrder"("userId", "poNumber");
CREATE TABLE "new_PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT,
    "expenseAccountId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "taxPercent" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderLine" ("amount", "description", "id", "itemId", "purchaseOrderId", "quantity", "rate", "sortOrder", "taxPercent") SELECT "amount", "description", "id", "itemId", "purchaseOrderId", "quantity", "rate", "sortOrder", "taxPercent" FROM "PurchaseOrderLine";
DROP TABLE "PurchaseOrderLine";
ALTER TABLE "new_PurchaseOrderLine" RENAME TO "PurchaseOrderLine";
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");
CREATE INDEX "PurchaseOrderLine_expenseAccountId_idx" ON "PurchaseOrderLine"("expenseAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
