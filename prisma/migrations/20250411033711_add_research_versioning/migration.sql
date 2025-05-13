-- CreateTable
CREATE TABLE "research_versions" (
    "id" SERIAL NOT NULL,
    "research_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "change_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "research_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_versions_research_id_created_at_idx" ON "research_versions"("research_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "research_versions_research_id_version_number_key" ON "research_versions"("research_id", "version_number");

-- AddForeignKey
ALTER TABLE "research_versions" ADD CONSTRAINT "research_versions_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "industrial_application_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_versions" ADD CONSTRAINT "research_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
