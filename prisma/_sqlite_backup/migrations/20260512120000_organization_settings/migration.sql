-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationSettings_userId_key" ON "OrganizationSettings"("userId");
CREATE INDEX "OrganizationSettings_userId_idx" ON "OrganizationSettings"("userId");
