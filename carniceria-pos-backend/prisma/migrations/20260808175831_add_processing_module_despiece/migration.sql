-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'PROCESSING_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE 'PROCESSING_OUT';

-- AlterEnum
ALTER TYPE "WasteReason" ADD VALUE 'PROCESSING_LOSS';

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "parent_batch_id" UUID;

-- AlterTable
ALTER TABLE "inventory_wastes" ADD COLUMN     "processing_operation_id" UUID;

-- CreateTable
CREATE TABLE "processing_operations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "input_product_id" UUID NOT NULL,
    "input_batch_id" UUID,
    "input_quantity" DECIMAL(12,3) NOT NULL,
    "input_unit_cost" DECIMAL(14,2) NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'DRAFT',
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "processing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_output_items" (
    "id" UUID NOT NULL,
    "processing_operation_id" UUID NOT NULL,
    "output_product_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "sale_price_snapshot" DECIMAL(14,2) NOT NULL,
    "allocated_cost" DECIMAL(14,2),
    "output_batch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "processing_output_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processing_operations_code_key" ON "processing_operations"("code");

-- CreateIndex
CREATE INDEX "processing_operations_sucursal_id_idx" ON "processing_operations"("sucursal_id");

-- CreateIndex
CREATE INDEX "processing_operations_user_id_idx" ON "processing_operations"("user_id");

-- CreateIndex
CREATE INDEX "processing_operations_status_idx" ON "processing_operations"("status");

-- CreateIndex
CREATE INDEX "processing_operations_input_product_id_idx" ON "processing_operations"("input_product_id");

-- CreateIndex
CREATE INDEX "processing_operations_input_batch_id_idx" ON "processing_operations"("input_batch_id");

-- CreateIndex
CREATE INDEX "processing_operations_sync_status_idx" ON "processing_operations"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_output_items_output_batch_id_key" ON "processing_output_items"("output_batch_id");

-- CreateIndex
CREATE INDEX "processing_output_items_processing_operation_id_idx" ON "processing_output_items"("processing_operation_id");

-- CreateIndex
CREATE INDEX "processing_output_items_output_product_id_idx" ON "processing_output_items"("output_product_id");

-- CreateIndex
CREATE INDEX "batches_parent_batch_id_idx" ON "batches"("parent_batch_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_processing_operation_id_idx" ON "inventory_wastes"("processing_operation_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_parent_batch_id_fkey" FOREIGN KEY ("parent_batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_processing_operation_id_fkey" FOREIGN KEY ("processing_operation_id") REFERENCES "processing_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_operations" ADD CONSTRAINT "processing_operations_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_operations" ADD CONSTRAINT "processing_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_operations" ADD CONSTRAINT "processing_operations_input_product_id_fkey" FOREIGN KEY ("input_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_operations" ADD CONSTRAINT "processing_operations_input_batch_id_fkey" FOREIGN KEY ("input_batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_output_items" ADD CONSTRAINT "processing_output_items_processing_operation_id_fkey" FOREIGN KEY ("processing_operation_id") REFERENCES "processing_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_output_items" ADD CONSTRAINT "processing_output_items_output_product_id_fkey" FOREIGN KEY ("output_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_output_items" ADD CONSTRAINT "processing_output_items_output_batch_id_fkey" FOREIGN KEY ("output_batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
