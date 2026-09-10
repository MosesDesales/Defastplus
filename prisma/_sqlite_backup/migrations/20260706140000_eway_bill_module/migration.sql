-- CreateTable
CREATE TABLE "EWayBillSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "valueThresholdInr" DECIMAL NOT NULL DEFAULT 50000,
    "autoSuggestInterstate" BOOLEAN NOT NULL DEFAULT true,
    "autoSuggestOverThreshold" BOOLEAN NOT NULL DEFAULT true,
    "gspProvider" TEXT NOT NULL DEFAULT 'sandbox',
    "apiCredentialsEnc" TEXT,
    "sandboxMode" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EWayBillSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "transporterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EWayBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "documentType" TEXT NOT NULL DEFAULT 'TAX_INVOICE',
    "invoiceId" TEXT,
    "sourceDocumentNumber" TEXT NOT NULL,
    "sourceDocumentDate" DATETIME NOT NULL,
    "documentValue" DECIMAL NOT NULL,
    "ewayBillNumber" TEXT,
    "generatedAt" DATETIME,
    "validUntil" DATETIME,
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
    "transportMode" TEXT NOT NULL DEFAULT 'ROAD',
    "vehicleNumber" TEXT,
    "vehicleType" TEXT NOT NULL DEFAULT 'REGULAR',
    "distanceKm" INTEGER,
    "placeOfSupply" TEXT,
    "supplyType" TEXT,
    "subSupplyType" TEXT,
    "transactionType" TEXT NOT NULL DEFAULT 'Regular',
    "errorMessage" TEXT,
    "lastApiResponseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EWayBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EWayBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EWayBill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EWayBill_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EWayBillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ewayBillId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "taxableValue" DECIMAL NOT NULL,
    "cgstRate" DECIMAL NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL NOT NULL DEFAULT 0,
    "igstRate" DECIMAL NOT NULL DEFAULT 0,
    "cessRate" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EWayBillLine_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EWayBillVehicleUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ewayBillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "transportMode" TEXT,
    "reason" TEXT,
    "updatedFrom" TEXT,
    "apiResponseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EWayBillVehicleUpdate_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EWayBillStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ewayBillId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EWayBillStatusHistory_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EWayBillApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ewayBillId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestJson" TEXT,
    "responseJson" TEXT,
    "httpStatus" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EWayBillApiLog_ewayBillId_fkey" FOREIGN KEY ("ewayBillId") REFERENCES "EWayBill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EWayBillSettings_userId_key" ON "EWayBillSettings"("userId");
CREATE INDEX "EWayBillSettings_userId_idx" ON "EWayBillSettings"("userId");
CREATE INDEX "Transporter_userId_idx" ON "Transporter"("userId");
CREATE INDEX "Transporter_userId_name_idx" ON "Transporter"("userId", "name");
CREATE UNIQUE INDEX "EWayBill_userId_ewayBillNumber_key" ON "EWayBill"("userId", "ewayBillNumber");
CREATE INDEX "EWayBill_userId_status_idx" ON "EWayBill"("userId", "status");
CREATE INDEX "EWayBill_userId_createdAt_idx" ON "EWayBill"("userId", "createdAt");
CREATE INDEX "EWayBill_userId_sourceDocumentNumber_idx" ON "EWayBill"("userId", "sourceDocumentNumber");
CREATE INDEX "EWayBill_invoiceId_idx" ON "EWayBill"("invoiceId");
CREATE INDEX "EWayBill_customerId_idx" ON "EWayBill"("customerId");
CREATE INDEX "EWayBill_vehicleNumber_idx" ON "EWayBill"("vehicleNumber");
CREATE INDEX "EWayBillLine_ewayBillId_idx" ON "EWayBillLine"("ewayBillId");
CREATE INDEX "EWayBillVehicleUpdate_ewayBillId_idx" ON "EWayBillVehicleUpdate"("ewayBillId");
CREATE INDEX "EWayBillVehicleUpdate_userId_createdAt_idx" ON "EWayBillVehicleUpdate"("userId", "createdAt");
CREATE INDEX "EWayBillStatusHistory_ewayBillId_idx" ON "EWayBillStatusHistory"("ewayBillId");
CREATE INDEX "EWayBillApiLog_userId_createdAt_idx" ON "EWayBillApiLog"("userId", "createdAt");
CREATE INDEX "EWayBillApiLog_ewayBillId_idx" ON "EWayBillApiLog"("ewayBillId");
