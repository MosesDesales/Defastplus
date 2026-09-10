-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerId" TEXT,
    "invoiceNumber" TEXT,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "journalEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseExpense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseExpense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseExpense" ("amount", "attachmentUrl", "bankAccountId", "createdAt", "expenseAccountId", "expenseDate", "id", "journalEntryId", "notes", "taxAmount", "userId") SELECT "amount", "attachmentUrl", "bankAccountId", "createdAt", "expenseAccountId", "expenseDate", "id", "journalEntryId", "notes", "taxAmount", "userId" FROM "PurchaseExpense";
DROP TABLE "PurchaseExpense";
ALTER TABLE "new_PurchaseExpense" RENAME TO "PurchaseExpense";
CREATE UNIQUE INDEX "PurchaseExpense_journalEntryId_key" ON "PurchaseExpense"("journalEntryId");
CREATE INDEX "PurchaseExpense_userId_idx" ON "PurchaseExpense"("userId");
CREATE INDEX "PurchaseExpense_userId_expenseDate_idx" ON "PurchaseExpense"("userId", "expenseDate");
CREATE INDEX "PurchaseExpense_vendorId_idx" ON "PurchaseExpense"("vendorId");
CREATE INDEX "PurchaseExpense_customerId_idx" ON "PurchaseExpense"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
