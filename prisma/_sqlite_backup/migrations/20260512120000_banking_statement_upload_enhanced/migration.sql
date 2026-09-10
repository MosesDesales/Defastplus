-- Enhanced bank statement upload metadata and per-transaction dedup fingerprints
ALTER TABLE "BankStatementImport" ADD COLUMN "fileMime" TEXT;
ALTER TABLE "BankStatementImport" ADD COLUMN "fileSizeBytes" INTEGER;
ALTER TABLE "BankStatementImport" ADD COLUMN "duplicateHint" TEXT;

ALTER TABLE "BankingTransaction" ADD COLUMN "sourceFingerprint" TEXT;

CREATE INDEX "BankingTransaction_bankingAccountId_sourceFingerprint_idx" ON "BankingTransaction"("bankingAccountId", "sourceFingerprint");
