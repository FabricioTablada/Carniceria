-- CreateTable
CREATE TABLE "processing_waste_items" (
    "id" UUID NOT NULL,
    "processing_operation_id" UUID NOT NULL,
    "reason" "WasteReason" NOT NULL DEFAULT 'PROCESSING_LOSS',
    "quantity" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "processing_waste_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_waste_items_processing_operation_id_idx" ON "processing_waste_items"("processing_operation_id");

-- AddForeignKey
ALTER TABLE "processing_waste_items" ADD CONSTRAINT "processing_waste_items_processing_operation_id_fkey" FOREIGN KEY ("processing_operation_id") REFERENCES "processing_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
