-- Invoice document summary (discount / TDS / TCS / adjustment / payable total)
ALTER TABLE "Invoice" ADD COLUMN "discountPercent" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "withholdingType" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Invoice" ADD COLUMN "withholdingPercent" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentLabel" TEXT NOT NULL DEFAULT 'Adjustment';
ALTER TABLE "Invoice" ADD COLUMN "adjustmentAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "payableTotal" REAL NOT NULL DEFAULT 0;
UPDATE "Invoice" SET "payableTotal" = "total";
