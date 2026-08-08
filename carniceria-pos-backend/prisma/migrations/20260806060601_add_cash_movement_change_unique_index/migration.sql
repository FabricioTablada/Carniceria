-- Version 1.0.3, Bloque 1: nunca debe existir mas de un CashMovement tipo
-- CHANGE activo (deleted_at IS NULL) para la misma venta (reference_type =
-- 'SALE', reference_id = Sale.id) — indice unico PARCIAL, no declarable en
-- schema.prisma (sin soporte nativo de indices parciales), agregado a mano.
-- Separado en su propia migracion porque Postgres no permite usar un valor
-- de enum recien agregado (`CHANGE`, migracion anterior) dentro de la misma
-- transaccion que lo agrega. Red de seguridad a nivel de base de datos: la
-- capa de aplicacion (`sales/service.ts`) ya hace soft-delete del CHANGE
-- activo antes de crear uno nuevo, este indice solo protege contra un
-- bug/carrera que viole esa regla. No afecta a REFUND ni a ningun otro
-- tipo/registro existente (filtro explicito por "type" = 'CHANGE').
CREATE UNIQUE INDEX "cash_movements_active_change_reference_key"
ON "cash_movements" ("reference_type", "reference_id")
WHERE "deleted_at" IS NULL AND "type" = 'CHANGE';
