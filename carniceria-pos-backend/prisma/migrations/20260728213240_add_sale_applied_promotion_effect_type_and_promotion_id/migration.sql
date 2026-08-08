-- AlterTable
ALTER TABLE "sale_applied_promotions" ADD COLUMN     "effect_type" "PromotionEffectType",
ADD COLUMN     "promotion_id" UUID;

-- CreateIndex
CREATE INDEX "sale_applied_promotions_promotion_id_idx" ON "sale_applied_promotions"("promotion_id");

-- AddForeignKey
ALTER TABLE "sale_applied_promotions" ADD CONSTRAINT "sale_applied_promotions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
