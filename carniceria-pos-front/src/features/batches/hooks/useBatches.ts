import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { batchesApi } from '../api/batches.api'
import type { BatchFilters, PaginatedBatchesResponse } from '../types/batch.types'

/** Mismo criterio que `useInventoryWastes.ts`: `filters` incluye tanto los
 * filtros reales (productId/sucursalId/supplierId/status) como la
 * paginacion (page/limit) en un solo objeto opcional, pasado tal cual a
 * `batchesApi.getBatches` como query params.
 *
 * QA.4 (Compras): `enabled` (opcional, `true` por defecto — mismo criterio
 * que `useInventory.ts`/`useInventoryWastes.ts`) permite a un consumidor
 * posponer la consulta hasta tener filtros reales — sin esto,
 * `usePurchaseBatches.ts` disparaba `GET /inventory/batches` SIN NINGUN
 * filtro (ni `supplierId` ni `limit`) mientras la compra todavia se estaba
 * cargando (`purchase` es `undefined` en ese instante), una peticion
 * innecesaria que la consulta real (acotada por `supplierId`) reemplazaba
 * de inmediato. */
export function useBatches(filters?: BatchFilters, options?: { enabled?: boolean }) {
  return useQuery<PaginatedBatchesResponse, AxiosError>({
    queryKey: ['batches', 'list', filters],
    queryFn: () => batchesApi.getBatches(filters),
    enabled: options?.enabled,
  })
}
