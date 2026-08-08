import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { INVENTORY_WASTE_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { inventoryApi } from '../api/inventory.api'
import type { CreateInventoryWasteDto, InventoryWaste } from '../types/inventory.types'

/**
 * features/inventory/hooks/useCreateInventoryWaste.ts
 * -----------------------------------------------------------------------------
 * Corrección del sistema de invalidación (aprobado): grupo propio
 * `INVENTORY_WASTE_AFFECTED_QUERY_KEYS` (antes compartía la lista de
 * `useUpdateInventory.ts`, que no incluía `reports/waste` ni `batches`/
 * `reports/batches` — una merma sí puede afectar ambos, un simple ajuste
 * de cantidad no). Único punto de mantenimiento — ver `reportQueryKeys.ts`.
 */
export function useCreateInventoryWaste() {
  const queryClient = useQueryClient()

  return useMutation<InventoryWaste, AxiosError, CreateInventoryWasteDto>({
    mutationFn: (dto) => inventoryApi.createWaste(dto),
    onSuccess: () => {
      for (const queryKey of INVENTORY_WASTE_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
