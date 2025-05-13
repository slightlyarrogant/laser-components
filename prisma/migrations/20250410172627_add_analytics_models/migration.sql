-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reset_token_expiry" TIMESTAMP(3),
ADD COLUMN     "reset_token_hash" TEXT;

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_values" (
    "id" SERIAL NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_aggregates" (
    "id" SERIAL NOT NULL,
    "metric_name" TEXT NOT NULL,
    "dimensions" JSONB,
    "count" INTEGER NOT NULL,
    "sum" DOUBLE PRECISION,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "avg" DOUBLE PRECISION,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX "analytics_events_category_idx" ON "analytics_events"("category");

-- CreateIndex
CREATE INDEX "analytics_events_action_idx" ON "analytics_events"("action");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "metric_values_metric_name_idx" ON "metric_values"("metric_name");

-- CreateIndex
CREATE INDEX "metric_values_timestamp_idx" ON "metric_values"("timestamp");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_resource_type_idx" ON "activity_logs"("resource_type");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");

-- CreateIndex
CREATE INDEX "metric_aggregates_metric_name_idx" ON "metric_aggregates"("metric_name");

-- CreateIndex
CREATE INDEX "metric_aggregates_start_date_end_date_idx" ON "metric_aggregates"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "metric_aggregates_metric_name_dimensions_start_date_end_dat_key" ON "metric_aggregates"("metric_name", "dimensions", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
