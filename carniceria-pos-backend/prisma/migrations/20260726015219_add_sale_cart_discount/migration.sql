-- CreateEnum
CREATE TYPE "SaleDiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "discount_type" "SaleDiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "discount_value" DECIMAL(14,2) NOT NULL DEFAULT 0;
