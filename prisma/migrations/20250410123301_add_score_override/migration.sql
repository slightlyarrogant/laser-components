-- CreateTable
CREATE TABLE "score_overrides" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "score" INTEGER,
    "component_overrides" TEXT,
    "metadata" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "score_overrides_lead_id_key" ON "score_overrides"("lead_id");

-- AddForeignKey
ALTER TABLE "score_overrides" ADD CONSTRAINT "score_overrides_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
