-- Tally migration module

CREATE TABLE "TallyMigrationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "integrationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceType" TEXT NOT NULL DEFAULT 'xml_upload',
    "fileName" TEXT,
    "phasesJson" TEXT,
    "statsJson" TEXT,
    "reconcileJson" TEXT,
    "errorSummary" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TallyMigrationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TallyMigrationJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "TallyMigrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "phase" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyMigrationLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TallyEntityMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "entityType" TEXT NOT NULL,
    "tallyKey" TEXT NOT NULL,
    "tallyGuid" TEXT,
    "erpModel" TEXT NOT NULL,
    "erpId" TEXT NOT NULL,
    "parentTallyKey" TEXT,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TallyEntityMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TallyEntityMap_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "TallyMigrationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "parsedJson" TEXT,
    "sourceHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyMigrationSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TallyMigrationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Account" ADD COLUMN "tallyGuid" TEXT;
ALTER TABLE "Account" ADD COLUMN "tallyParentName" TEXT;
ALTER TABLE "Account" ADD COLUMN "isTallyGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JournalEntry" ADD COLUMN "tallyVoucherKey" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "tallyVoucherType" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "tallyVoucherNumber" TEXT;

CREATE INDEX "TallyMigrationJob_userId_createdAt_idx" ON "TallyMigrationJob"("userId", "createdAt");
CREATE INDEX "TallyMigrationJob_integrationId_idx" ON "TallyMigrationJob"("integrationId");
CREATE INDEX "TallyMigrationLog_jobId_createdAt_idx" ON "TallyMigrationLog"("jobId", "createdAt");
CREATE INDEX "TallyMigrationLog_jobId_level_idx" ON "TallyMigrationLog"("jobId", "level");
CREATE UNIQUE INDEX "TallyEntityMap_userId_entityType_tallyKey_key" ON "TallyEntityMap"("userId", "entityType", "tallyKey");
CREATE INDEX "TallyEntityMap_userId_entityType_idx" ON "TallyEntityMap"("userId", "entityType");
CREATE INDEX "TallyEntityMap_userId_tallyGuid_idx" ON "TallyEntityMap"("userId", "tallyGuid");
CREATE INDEX "TallyEntityMap_jobId_idx" ON "TallyEntityMap"("jobId");
CREATE UNIQUE INDEX "TallyMigrationSnapshot_jobId_key" ON "TallyMigrationSnapshot"("jobId");
CREATE INDEX "Account_userId_tallyGuid_idx" ON "Account"("userId", "tallyGuid");
CREATE INDEX "JournalEntry_userId_tallyVoucherKey_idx" ON "JournalEntry"("userId", "tallyVoucherKey");
