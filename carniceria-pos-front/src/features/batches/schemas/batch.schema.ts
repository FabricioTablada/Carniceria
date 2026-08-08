import { z } from 'zod'
import type { UpdateBatchDto } from '../types/batch.types'

const BATCH_STATUS_VALUES = ['ACTIVE', 'DEPLETED', 'EXPIRED', 'BLOCKED'] as const

/**
 * features/batches/schemas/batch.schema.ts
 * -----------------------------------------------------------------------------
 * Replica de `UpdateBatchSchema` (modules/batches/validation.ts, backend).
 * Zod v4 (`.min(1, mensaje)` en vez de `required_error`), mismo criterio ya
 * usado en `inventory.schema.ts`/`product.schema.ts`/etc.
 *
 * `maxAvailableQuantity` (unico agregado respecto al backend, puramente de
 * UX): el backend valida de forma autoritativa que `availableQuantity` no
 * supere `Batch.initialQuantity` (`batches/service.ts::update`) — esto solo
 * evita el viaje de red para el caso invalido, mismo criterio ya usado en
 * `createInventoryWasteSchema` (`inventory.schema.ts`). Se arma como fabrica
 * porque el maximo cambia por lote (su `initialQuantity`).
 */
export function updateBatchSchema(maxAvailableQuantity: number): z.ZodType<UpdateBatchDto> {
  return z.object({
    availableQuantity: z
      .number()
      .min(0, 'La cantidad disponible no puede ser negativa.')
      .max(
        maxAvailableQuantity,
        `La cantidad disponible no puede superar la cantidad inicial del lote (${maxAvailableQuantity}).`,
      )
      .optional(),
    status: z.enum(BATCH_STATUS_VALUES).optional(),
    notes: z.string().trim().nullish(),
  })
}
