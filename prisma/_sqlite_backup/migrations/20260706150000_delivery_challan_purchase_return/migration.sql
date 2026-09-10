-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "reference" TEXT,
    "challanDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "subTotal" DECIMAL NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryChallan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryChallan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryChallan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DeliveryChallanLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challanId" TEXT NOT NULL,
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
    CONSTRAINT "DeliveryChallanLine_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryChallanLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "reference" TEXT,
    "returnDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorBillId" TEXT,
    "reason" TEXT,
    "subTotal" DECIMAL NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturn_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturn_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PurchaseReturnLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
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
    CONSTRAINT "PurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturnLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "EWayBill" ADD COLUMN "deliveryChallanId" TEXT;
ALTER TABLE "EWayBill" ADD COLUMN "purchaseReturnId" TEXT;

CREATE UNIQUE INDEX "DeliveryChallan_userId_challanNumber_key" ON "DeliveryChallan"("userId", "challanNumber");
CREATE INDEX "DeliveryChallan_userId_idx" ON "DeliveryChallan"("userId");
CREATE INDEX "DeliveryChallan_customerId_idx" ON "DeliveryChallan"("customerId");
CREATE INDEX "DeliveryChallan_status_idx" ON "DeliveryChallan"("status");
CREATE INDEX "DeliveryChallan_invoiceId_idx" ON "DeliveryChallan"("invoiceId");
CREATE INDEX "DeliveryChallanLine_challanId_idx" ON "DeliveryChallanLine"("challanId");
CREATE UNIQUE INDEX "PurchaseReturn_userId_returnNumber_key" ON "PurchaseReturn"("userId", "returnNumber");
CREATE INDEX "PurchaseReturn_userId_idx" ON "PurchaseReturn"("userId");
CREATE INDEX "PurchaseReturn_vendorId_idx" ON "PurchaseReturn"("vendorId");
CREATE INDEX "PurchaseReturn_status_idx" ON "PurchaseReturn"("status");
CREATE INDEX "PurchaseReturn_vendorBillId_idx" ON "PurchaseReturn"("vendorBillId");
CREATE INDEX "PurchaseReturnLine_returnId_idx" ON "PurchaseReturnLine"("returnId");
CREATE INDEX "EWayBill_deliveryChallanId_idx" ON "EWayBill"("deliveryChallanId");
CREATE INDEX "EWayBill_purchaseReturnId_idx" ON "EWayBill"("purchaseReturnId");
