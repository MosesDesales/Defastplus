ALTER TABLE "CompanyProfile" ADD COLUMN "gstRegistered" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstRegistrationType" TEXT;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstBusinessLegalName" TEXT;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstBusinessTradeName" TEXT;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstRegisteredOn" DATETIME;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstReverseChargeSales" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstSezOverseasTrading" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanyProfile" ADD COLUMN "gstDigitalServicesExport" INTEGER NOT NULL DEFAULT 0;
