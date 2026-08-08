import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { inventoryApi } from '../api/inventory.api'
import type { InventoryWaste } from '../types/inventory.types'

/** Mismo patron que `useInventoryItem.ts`: `enabled: Boolean(id)` permite
 * pasar `''` mientras el dialog de detalle esta cerrado (id-como-estado,
 * mismo criterio que `SaleDetailDialog.tsx`) sin disparar una consulta
 * invalida. */
export function useInventoryWaste(id: string) {
  return useQuery<InventoryWaste, AxiosError>({
    queryKey: ['inventory', 'wastes', 'detail', id],
    queryFn: () => inventoryApi.getWasteById(id),
    enabled: Boolean(id),
  })
}
