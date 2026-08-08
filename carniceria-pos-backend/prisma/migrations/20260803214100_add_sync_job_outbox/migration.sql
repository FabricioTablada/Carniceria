-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('CLOUD_PUSH');

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "job_type" "SyncJobType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_jobs_idempotency_key_key" ON "sync_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_sucursal_id_idx" ON "sync_jobs"("sucursal_id");

-- CreateIndex
CREATE INDEX "sync_jobs_entity_type_entity_id_idx" ON "sync_jobs"("entity_type", "entity_id");
