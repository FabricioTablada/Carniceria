/*
  Warnings:

  - A unique constraint covering the columns `[legal_id]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_legal_id_key" ON "suppliers"("legal_id");
