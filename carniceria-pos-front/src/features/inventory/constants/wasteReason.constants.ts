import type { WasteReason } from '../types/inventory.types'

/**
 * features/inventory/constants/wasteReason.constants.ts
 * -----------------------------------------------------------------------------
 * Catalogo de etiquetas en español para `WasteReason` (enum `WasteReason`
 * de schema.prisma). Extraido de `InventoryWasteForm.tsx` (Bloque 3,
 * historial de mermas) para que el formulario, los filtros y la tabla del
 * historial compartan una unica fuente de verdad, sin duplicar el arreglo.
 */
export const WASTE_REASON_OPTIONS: { value: WasteReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Producto dañado' },
  { value: 'EXPIRED', label: 'Producto vencido' },
  { value: 'CUTTING_ERROR', label: 'Error de corte' },
  { value: 'PACKAGING_ERROR', label: 'Error de empaque' },
  { value: 'PRODUCTION_ERROR', label: 'Error de producción' },
  { value: 'COLD_CHAIN_FAILURE', label: 'Falla de cadena de frío' },
  { value: 'RETURNED_NOT_RESTOCKED', label: 'Devolución no reingresada' },
  { value: 'OTHER', label: 'Otro' },
]
