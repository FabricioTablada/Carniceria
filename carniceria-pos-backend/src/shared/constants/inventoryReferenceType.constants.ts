/**
 * shared/constants/inventoryReferenceType.constants.ts
 * -----------------------------------------------------------------------------
 * Catalogo centralizado de valores para `InventoryMovement.referenceType`
 * (Sprint QA 3.4). El campo en `prisma/schema.prisma` es `String?` (texto
 * libre, no enum de Postgres), por lo que este objeto es puramente un
 * refactor de tipado en la capa de aplicacion: no requiere cambios de
 * Prisma, migraciones, ni afecta los valores ya persistidos en
 * `inventory_movements.reference_type`. Reemplaza los strings literales
 * previamente repetidos en `modules/sales`, `modules/purchases`,
 * `modules/inventory`, `modules/inventoryWaste` y `modules/returns`.
 */
export const InventoryReferenceType = {
  SALE: 'SALE',
  SALE_VOID: 'SALE_VOID',
  SALE_RETURN: 'SALE_RETURN',
  PURCHASE: 'PURCHASE',
  INVENTORY_ADJUSTMENT: 'INVENTORY_ADJUSTMENT',
  INVENTORY_WASTE: 'INVENTORY_WASTE',
  // Bloque LOTES-01 (Modulo de Lotes): ajuste manual de la cantidad
  // disponible de un lote especifico (`PATCH /batches/:id`), distinto de
  // `INVENTORY_ADJUSTMENT` (ajuste del agregado sin lote asociado).
  BATCH_ADJUSTMENT: 'BATCH_ADJUSTMENT',
  // Modulo de Despiece (Bloque 2, plan v3): movimientos generados al
  // completar una ProcessingOperation — consumo del canal/producto de
  // entrada (`PROCESSING_OUT`) y acreditacion de cada corte/subproducto de
  // salida (`PROCESSING_IN`). Mismo `referenceId` para ambos: el id de la
  // ProcessingOperation.
  PROCESSING: 'PROCESSING',
} as const;

export type InventoryReferenceTypeName = (typeof InventoryReferenceType)[keyof typeof InventoryReferenceType];
