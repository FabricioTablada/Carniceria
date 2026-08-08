import { httpClient } from '@/lib/htpp/client'
import type { Batch, BatchFilters, PaginatedBatchesResponse, UpdateBatchDto } from '../types/batch.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * features/batches/api/batches.api.ts
 * -----------------------------------------------------------------------------
 * El modulo de Lotes se monta bajo `/inventory/batches` en el backend
 * (`inventory/routes.ts`, subordinado a Inventario, mismo criterio ya usado
 * para `/inventory/waste`) — no bajo un prefijo `/batches` propio. Sin
 * `createBatch`: no existe `POST /inventory/batches` (los lotes solo se
 * crean automaticamente desde Compras, ver nota de archivo en
 * `types/batch.types.ts`).
 */
export const batchesApi = {
  getBatches: async (filters?: BatchFilters): Promise<PaginatedBatchesResponse> => {
    const { data } = await httpClient.get<PaginatedBatchesResponse>('/inventory/batches', {
      params: filters,
    })

    return data
  },

  getBatchById: async (id: string): Promise<Batch> => {
    const { data } = await httpClient.get<ApiEnvelope<Batch>>(`/inventory/batches/${id}`)

    return data.data
  },

  updateBatch: async (id: string, data: UpdateBatchDto): Promise<Batch> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Batch>>(
      `/inventory/batches/${id}`,
      data,
    )

    return response.data
  },
}
