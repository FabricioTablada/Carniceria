import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { batchesApi } from '../api/batches.api'
import type { Batch } from '../types/batch.types'

/** Mismo patron que `useInventoryWaste.ts`: `enabled: Boolean(id)` permite
 * pasar `''` mientras el Drawer de detalle esta cerrado (id-como-estado,
 * mismo criterio que `InventoryWasteDrawer.tsx`) sin disparar una consulta
 * invalida. */
export function useBatch(id: string) {
  return useQuery<Batch, AxiosError>({
    queryKey: ['batches', 'detail', id],
    queryFn: () => batchesApi.getBatchById(id),
    enabled: Boolean(id),
  })
}
