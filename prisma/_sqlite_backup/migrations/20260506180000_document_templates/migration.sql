-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" INTEGER NOT NULL DEFAULT 0,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DocumentTemplate_userId_type_idx" ON "DocumentTemplate"("userId", "type");
CREATE INDEX "DocumentTemplate_userId_type_isDefault_idx" ON "DocumentTemplate"("userId", "type", "isDefault");

-- Redefine SQLite table Invoice is not trivial; use ALTER TABLE
ALTER TABLE "Invoice" ADD COLUMN "documentTemplateId" TEXT;
CREATE INDEX "Invoice_documentTemplateId_idx" ON "Invoice"("documentTemplateId");
