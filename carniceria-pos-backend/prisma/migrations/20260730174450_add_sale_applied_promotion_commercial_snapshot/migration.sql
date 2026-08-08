-- AlterTable
ALTER TABLE "sale_applied_promotions" ADD COLUMN     "commercial_origin" "PromotionOrigin" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "funding_type" "PromotionFundingType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "supplier_contribution_amount" DECIMAL(14,2),
ADD COLUMN     "supplier_id" UUID,
ADD COLUMN     "supplier_subsidy_value" DECIMAL(14,2);
