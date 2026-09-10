-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "exchangeRate" DECIMAL;
ALTER TABLE "Invoice" ADD COLUMN "baseTotal" DECIMAL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "PurchaseOrder" ADD COLUMN "exchangeRate" DECIMAL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "baseTotal" DECIMAL;

-- AlterTable
ALTER TABLE "VendorBill" ADD COLUMN "exchangeRate" DECIMAL;
ALTER TABLE "VendorBill" ADD COLUMN "baseTotal" DECIMAL;
