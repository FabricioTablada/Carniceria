-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'BLOCKED');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "batch_id" UUID;

-- AlterTable
ALTER TABLE "inventory_wastes" ADD COLUMN     "batch_id" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "requires_batch" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "supplier_lot_code" TEXT,
    "product_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "purchase_item_id" UUID,
    "supplier_id" UUID,
    "received_at" TIMESTAMP(3) NOT NULL,
    "production_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "initial_quantity" DECIMAL(12,3) NOT NULL,
    "available_quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(14,2) NOT NULL,
    "expected_waste_percent" DECIMAL(5,2),
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batches_code_key" ON "batches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "batches_purchase_item_id_key" ON "batches"("purchase_item_id");

-- CreateIndex
CREATE INDEX "batches_product_id_idx" ON "batches"("product_id");

-- CreateIndex
CREATE INDEX "batches_sucursal_id_idx" ON "batches"("sucursal_id");

-- CreateIndex
CREATE INDEX "batches_product_id_sucursal_id_status_idx" ON "batches"("product_id", "sucursal_id", "status");

-- CreateIndex
CREATE INDEX "batches_supplier_id_idx" ON "batches"("supplier_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_expiry_date_idx" ON "batches"("expiry_date");

-- CreateIndex
CREATE INDEX "batches_sync_status_idx" ON "batches"("sync_status");

-- CreateIndex
CREATE INDEX "inventory_movements_batch_id_idx" ON "inventory_movements"("batch_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_batch_id_idx" ON "inventory_wastes"("batch_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
