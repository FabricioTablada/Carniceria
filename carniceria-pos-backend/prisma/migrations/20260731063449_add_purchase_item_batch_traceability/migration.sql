-- AlterTable
ALTER TABLE "purchase_items" ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "production_date" TIMESTAMP(3),
ADD COLUMN     "supplier_lot_code" TEXT;
