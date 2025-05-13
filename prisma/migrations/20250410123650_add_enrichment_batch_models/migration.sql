-- CreateEnum
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "enrichment_batches" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalJobs" INTEGER NOT NULL,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "failed_jobs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrichment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_jobs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "result" TEXT,
    "error" TEXT,
    "last_attempt_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrichment_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrichment_jobs_batch_id_lead_id_key" ON "enrichment_jobs"("batch_id", "lead_id");

-- AddForeignKey
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "enrichment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
