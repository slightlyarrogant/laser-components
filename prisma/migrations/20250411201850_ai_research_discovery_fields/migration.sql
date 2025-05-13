-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResearchStatus" ADD VALUE 'AI_DISCOVERED';
ALTER TYPE "ResearchStatus" ADD VALUE 'REVIEWED';
ALTER TYPE "ResearchStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "industrial_application_research" ADD COLUMN     "discovered_from_product_id" INTEGER;

-- AddForeignKey
ALTER TABLE "industrial_application_research" ADD CONSTRAINT "industrial_application_research_discovered_from_product_id_fkey" FOREIGN KEY ("discovered_from_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
