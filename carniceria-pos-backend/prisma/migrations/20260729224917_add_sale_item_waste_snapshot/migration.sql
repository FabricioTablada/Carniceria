-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "expected_waste_percent_at_sale" DECIMAL(5,2),
ADD COLUMN     "apply_expected_waste_to_cost_at_sale" BOOLEAN;
