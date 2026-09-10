-- OCR vendor templates + extended audit fields on OcrDocument
ALTER TABLE "OcrDocument" ADD COLUMN "fieldConfidenceJson" TEXT;
ALTER TABLE "OcrDocument" ADD COLUMN "auditLogJson" TEXT;

CREATE TABLE "OcrVendorTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vendorGstin" TEXT,
    "vendorNameKey" TEXT NOT NULL,
    "layoutHintsJson" TEXT,
    "sampleTextPreview" TEXT,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OcrVendorTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OcrVendorTemplate_userId_idx" ON "OcrVendorTemplate"("userId");
CREATE INDEX "OcrVendorTemplate_userId_vendorGstin_idx" ON "OcrVendorTemplate"("userId", "vendorGstin");
CREATE INDEX "OcrVendorTemplate_userId_vendorNameKey_idx" ON "OcrVendorTemplate"("userId", "vendorNameKey");
