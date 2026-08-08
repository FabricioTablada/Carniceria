import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { inventoryApi } from '../api/inventory.api'
import type { Inventory } from '../types/inventory.types'

export function useInventoryItem(id: string) {
  return useQuery<Inventory, AxiosError>({
    queryKey: ['inventory', 'detail', id],
    queryFn: () => inventoryApi.getInventoryById(id),
    enabled: Boolean(id),
  })
}