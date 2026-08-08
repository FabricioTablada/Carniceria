-- CreateEnum
CREATE TYPE "PromotionOrigin" AS ENUM ('INTERNAL', 'SUPPLIER_MANDATED');

-- CreateEnum
CREATE TYPE "PromotionFundingType" AS ENUM ('NONE', 'SUPPLIER_SUBSIDY_PER_UNIT', 'SUPPLIER_SUBSIDY_PERCENTAGE');

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "commercial_origin" "PromotionOrigin" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "funding_type" "PromotionFundingType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "supplier_id" UUID,
ADD COLUMN     "supplier_subsidy_value" DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "promotions_supplier_id_idx" ON "promotions"("supplier_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
