-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "nextRunDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expenseAccountId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerId" TEXT,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "lastGeneratedAt" DATETIME,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecurringExpense" ("amount", "bankAccountId", "endDate", "expenseAccountId", "frequency", "id", "isActive", "lastGeneratedAt", "nextRunDate", "notes", "startDate", "taxAmount", "userId") SELECT "amount", "bankAccountId", "endDate", "expenseAccountId", "frequency", "id", "isActive", "lastGeneratedAt", "nextRunDate", "notes", "startDate", "taxAmount", "userId" FROM "RecurringExpense";
DROP TABLE "RecurringExpense";
ALTER TABLE "new_RecurringExpense" RENAME TO "RecurringExpense";
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");
CREATE INDEX "RecurringExpense_vendorId_idx" ON "RecurringExpense"("vendorId");
CREATE INDEX "RecurringExpense_customerId_idx" ON "RecurringExpense"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
