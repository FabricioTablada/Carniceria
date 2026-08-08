import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { PURCHASE_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { purchasesApi } from '../api/purchases.api'
import type { Purchase, UpdatePurchaseDto } from '../types/purchase.types'

/**
 * features/purchases/hooks/useUpdatePurchase.ts
 * -----------------------------------------------------------------------------
 * `UpdatePurchaseDto` permite cambiar `status` — este es el hook que usa
 * `ReceivePurchaseDialog.tsx` para marcar una compra como `RECEIVED`
 * (aumenta stock y puede crear/reponer lotes), y también el que revierte
 * ese aumento al cancelar. Corrección del sistema de invalidación
 * (aprobado): único punto de mantenimiento por evento de dominio — ver
 * `reportQueryKeys.ts` (`PURCHASE_AFFECTED_QUERY_KEYS`, incluye
 * `batches`/`reports/batches`, antes ausentes).
 */
export function useUpdatePurchase() {
  const queryClient = useQueryClient()

  return useMutation<Purchase, AxiosError, { id: string; dto: UpdatePurchaseDto }>({
    mutationFn: ({ id, dto }) => purchasesApi.updatePurchase(id, dto),
    onSuccess: () => {
      for (const queryKey of PURCHASE_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
