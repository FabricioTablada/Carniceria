-- CreateEnum
CREATE TYPE "WasteReason" AS ENUM ('RETURNED_NOT_RESTOCKED', 'EXPIRED', 'DAMAGED', 'PRODUCTION_ERROR', 'CUTTING_ERROR', 'PACKAGING_ERROR', 'COLD_CHAIN_FAILURE', 'OTHER');

-- CreateTable
CREATE TABLE "inventory_wastes" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" "WasteReason" NOT NULL,
    "notes" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_value" DECIMAL(14,2) NOT NULL,
    "total_value" DECIMAL(14,2) NOT NULL,
    "source_return_item_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "inventory_wastes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_wastes_source_return_item_id_key" ON "inventory_wastes"("source_return_item_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_sucursal_id_idx" ON "inventory_wastes"("sucursal_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_product_id_idx" ON "inventory_wastes"("product_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_user_id_idx" ON "inventory_wastes"("user_id");

-- CreateIndex
CREATE INDEX "inventory_wastes_reason_idx" ON "inventory_wastes"("reason");

-- CreateIndex
CREATE INDEX "inventory_wastes_sync_status_idx" ON "inventory_wastes"("sync_status");

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_wastes" ADD CONSTRAINT "inventory_wastes_source_return_item_id_fkey" FOREIGN KEY ("source_return_item_id") REFERENCES "sale_return_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

