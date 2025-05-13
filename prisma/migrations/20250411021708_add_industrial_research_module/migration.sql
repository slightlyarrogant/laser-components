/*
  Warnings:

  - You are about to drop the column `error` on the `enrichment_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `max_attempts` on the `enrichment_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `tag_presets` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `tag_presets` table. All the data in the column will be lost.
  - Added the required column `provider` to the `enrichment_jobs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "enrichment_jobs" DROP CONSTRAINT "enrichment_jobs_batch_id_fkey";

-- DropIndex
DROP INDEX "enrichment_jobs_batch_id_lead_id_key";

-- AlterTable
ALTER TABLE "enrichment_jobs" DROP COLUMN "error",
DROP COLUMN "max_attempts",
ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ALTER COLUMN "batch_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notes" DROP COLUMN "created_by",
ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "tag_presets" DROP COLUMN "color",
DROP COLUMN "created_by";

-- CreateTable
CREATE TABLE "industrial_application_research" (
    "id" SERIAL NOT NULL,
    "application_name" TEXT NOT NULL,
    "industry_sector" TEXT,
    "use_case_description" TEXT,
    "market_potential" TEXT,
    "technical_requirements" TEXT,
    "competitive_landscape" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "subcategory_id" INTEGER,
    "product_id" INTEGER,
    "ai_summary" TEXT,
    "ai_recommendations" TEXT,
    "ai_confidence_score" DOUBLE PRECISION,

    CONSTRAINT "industrial_application_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_attachments" (
    "id" SERIAL NOT NULL,
    "research_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "description" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "research_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_collaborators" (
    "research_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,

    CONSTRAINT "research_collaborators_pkey" PRIMARY KEY ("research_id","user_id")
);

-- CreateIndex
CREATE INDEX "enrichment_jobs_status_last_attempt_at_idx" ON "enrichment_jobs"("status", "last_attempt_at");

-- AddForeignKey
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "enrichment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industrial_application_research" ADD CONSTRAINT "industrial_application_research_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industrial_application_research" ADD CONSTRAINT "industrial_application_research_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industrial_application_research" ADD CONSTRAINT "industrial_application_research_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_attachments" ADD CONSTRAINT "research_attachments_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "industrial_application_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_attachments" ADD CONSTRAINT "research_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_collaborators" ADD CONSTRAINT "research_collaborators_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "industrial_application_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_collaborators" ADD CONSTRAINT "research_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
