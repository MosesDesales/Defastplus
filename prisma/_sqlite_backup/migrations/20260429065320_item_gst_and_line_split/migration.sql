-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "taxPercent" DECIMAL NOT NULL DEFAULT 0,
    "lineNet" DECIMAL NOT NULL,
    "lineTax" DECIMAL NOT NULL,
    "lineTotal" DECIMAL NOT NULL,
    "lineCgst" DECIMAL NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceLine" ("description", "id", "invoiceId", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent") SELECT "description", "id", "invoiceId", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent" FROM "InvoiceLine";
DROP TABLE "InvoiceLine";
ALTER TABLE "new_InvoiceLine" RENAME TO "InvoiceLine";
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'GOODS',
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "salesDescription" TEXT,
    "salesRate" DECIMAL NOT NULL DEFAULT 0,
    "purchaseDescription" TEXT,
    "purchaseRate" DECIMAL NOT NULL DEFAULT 0,
    "sellable" BOOLEAN NOT NULL DEFAULT true,
    "purchasable" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "inventoryUnitId" TEXT,
    "reorderLevel" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "gstTaxPreference" TEXT NOT NULL DEFAULT 'TAXABLE',
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "gstRate" DECIMAL NOT NULL DEFAULT 0,
    "hsnCode" TEXT,
    "gstTaxMode" TEXT NOT NULL DEFAULT 'AUTO',
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "InventoryUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("categoryId", "createdAt", "description", "id", "inventoryUnitId", "isActive", "itemType", "name", "purchasable", "purchaseDescription", "purchaseRate", "reorderLevel", "salesDescription", "salesRate", "sellable", "sku", "unit", "updatedAt", "userId") SELECT "categoryId", "createdAt", "description", "id", "inventoryUnitId", "isActive", "itemType", "name", "purchasable", "purchaseDescription", "purchaseRate", "reorderLevel", "salesDescription", "salesRate", "sellable", "sku", "unit", "updatedAt", "userId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE INDEX "Item_userId_sku_idx" ON "Item"("userId", "sku");
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");
CREATE INDEX "Item_inventoryUnitId_idx" ON "Item"("inventoryUnitId");
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
    "lineCgst" DECIMAL NOT NULL DEFAULT 0,
    "lineSgst" DECIMAL NOT NULL DEFAULT 0,
    "lineIgst" DECIMAL NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorBillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VendorBillLine" ("billId", "customerId", "description", "discountPercent", "expenseAccountId", "id", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent") SELECT "billId", "customerId", "description", "discountPercent", "expenseAccountId", "id", "itemId", "lineNet", "lineTax", "lineTotal", "quantity", "rate", "sortOrder", "taxPercent" FROM "VendorBillLine";
DROP TABLE "VendorBillLine";
ALTER TABLE "new_VendorBillLine" RENAME TO "VendorBillLine";
CREATE INDEX "VendorBillLine_billId_idx" ON "VendorBillLine"("billId");
CREATE INDEX "VendorBillLine_customerId_idx" ON "VendorBillLine"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
