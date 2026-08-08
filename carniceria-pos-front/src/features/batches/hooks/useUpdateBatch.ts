import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { BATCH_ADJUSTMENT_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { batchesApi } from '../api/batches.api'
import type { Batch, UpdateBatchDto } from '../types/batch.types'

/**
 * Ajusta (`availableQuantity`) y/o bloquea/cierra (`status`) un lote
 * existente (`PATCH /inventory/batches/:id`).
 *
 * Invalidacion: cuando el body incluye `availableQuantity`, el backend
 * registra el ajuste via `recordMovement()` (`type: ADJUSTMENT`), que
 * TAMBIEN sincroniza `Inventory.quantity` de forma atomica (Bloque
 * LOTES-01, invariante `SUM(Batch.availableQuantity ACTIVA) =
 * Inventory.quantity`) — mismo motivo por el que `useUpdateInventory.ts`
 * invalida ademas `['inventory']`/`['notifications']` (un ajuste de lote
 * puede resolver o disparar `NEGATIVE_STOCK`/`LOW_STOCK` igual que un
 * ajuste directo de inventario).
 *
 * Corrección del sistema de invalidación (aprobado): antes solo invalidaba
 * `batches`/`inventory`/`notifications` — `reports/batches` (conteo por
 * estado/próximos a vencer) y `reports/low-stock` quedaban desactualizados.
 * Único punto de mantenimiento — ver `reportQueryKeys.ts`
 * (`BATCH_ADJUSTMENT_AFFECTED_QUERY_KEYS`).
 */
export function useUpdateBatch() {
  const queryClient = useQueryClient()

  return useMutation<Batch, AxiosError, { id: string; dto: UpdateBatchDto }>({
    mutationFn: ({ id, dto }) => batchesApi.updateBatch(id, dto),
    onSuccess: () => {
      for (const queryKey of BATCH_ADJUSTMENT_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
