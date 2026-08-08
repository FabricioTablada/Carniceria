import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { PURCHASE_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { purchasesApi } from '../api/purchases.api'
import type { CreatePurchaseDto, Purchase } from '../types/purchase.types'

export function useCreatePurchase() {
  const queryClient = useQueryClient()

  return useMutation<Purchase, AxiosError, CreatePurchaseDto>({
    mutationFn: (dto) => purchasesApi.createPurchase(dto),
    onSuccess: () => {
      // Corrección del sistema de invalidación (aprobado): único punto de
      // mantenimiento por evento de dominio — ver `reportQueryKeys.ts`.
      // Incluye `batches`/`reports/batches` (una compra recibida puede
      // crear/reponer lotes para productos con `requiresBatch`).
      for (const queryKey of PURCHASE_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
