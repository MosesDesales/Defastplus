CREATE TABLE "OcrDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileBytes" BLOB NOT NULL,
    "originalName" TEXT,
    "rawText" TEXT,
    "extractedJson" TEXT,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OcrDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OcrDocument_userId_idx" ON "OcrDocument"("userId");
CREATE INDEX "OcrDocument_userId_status_idx" ON "OcrDocument"("userId", "status");
CREATE INDEX "OcrDocument_userId_createdAt_idx" ON "OcrDocument"("userId", "createdAt");
