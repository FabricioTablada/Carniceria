import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { STOCK_ADJUSTMENT_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { inventoryApi } from '../api/inventory.api'
import type { Inventory, UpdateInventoryDto } from '../types/inventory.types'

export function useUpdateInventory() {
  const queryClient = useQueryClient()

  return useMutation<Inventory, AxiosError, { id: string; dto: UpdateInventoryDto }>({
    mutationFn: ({ id, dto }) => inventoryApi.updateInventory(id, dto),
    onSuccess: () => {
      // Corrección del sistema de invalidación (aprobado): único punto de
      // mantenimiento por evento de dominio — ver `reportQueryKeys.ts`.
      for (const queryKey of STOCK_ADJUSTMENT_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
