-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "sourceResearchId" INTEGER;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sourceResearchId_fkey" FOREIGN KEY ("sourceResearchId") REFERENCES "industrial_application_research"("id") ON DELETE SET NULL ON UPDATE CASCADE;
