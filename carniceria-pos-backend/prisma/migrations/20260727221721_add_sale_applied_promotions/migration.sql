-- CreateEnum
CREATE TYPE "PromotionSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateTable
CREATE TABLE "sale_applied_promotions" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "sale_item_id" UUID,
    "source" "PromotionSource" NOT NULL DEFAULT 'MANUAL',
    "applied_by_user_id" UUID,
    "promotion_name_snapshot" TEXT NOT NULL,
    "discount_type" "SaleDiscountType" NOT NULL,
    "discount_value" DECIMAL(14,2) NOT NULL,
    "amount_applied" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_applied_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_applied_promotions_sale_id_idx" ON "sale_applied_promotions"("sale_id");

-- CreateIndex
CREATE INDEX "sale_applied_promotions_sale_item_id_idx" ON "sale_applied_promotions"("sale_item_id");

-- AddForeignKey
ALTER TABLE "sale_applied_promotions" ADD CONSTRAINT "sale_applied_promotions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_applied_promotions" ADD CONSTRAINT "sale_applied_promotions_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_applied_promotions" ADD CONSTRAINT "sale_applied_promotions_applied_by_user_id_fkey" FOREIGN KEY ("applied_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
