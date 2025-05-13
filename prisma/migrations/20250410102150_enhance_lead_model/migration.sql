-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "annual_revenue" DECIMAL(15,2),
ADD COLUMN     "confidence" DECIMAL(5,2),
ADD COLUMN     "country_id" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "employee_count" INTEGER,
ADD COLUMN     "founded_year" INTEGER,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "last_enriched" TIMESTAMP(3),
ADD COLUMN     "linkedin_url" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "region_id" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "website" TEXT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
