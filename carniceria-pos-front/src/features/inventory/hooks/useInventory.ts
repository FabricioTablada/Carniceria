import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { inventoryApi } from '../api/inventory.api'
import type {
  InventoryFilters,
  PaginatedInventoryResponse,
} from '../types/inventory.types'

/** `enabled` (opcional, `true` por defecto — comportamiento identico al
 * que ya existia antes de agregarlo): permite a un consumidor posponer
 * la consulta hasta tener los filtros reales (ej. `ProductCatalogCard.tsx`
 * del POS, que necesita esperar a que se resuelva el `sucursalId` de la
 * sesion de caja antes de preguntar por el stock de un producto). Ningun
 * consumidor existente pasa este segundo argumento hoy, asi que ninguno
 * cambia de comportamiento. */
export function useInventory(
  filters?: InventoryFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<PaginatedInventoryResponse, AxiosError>({
    queryKey: ['inventory', 'list', filters],
    queryFn: () => inventoryApi.getInventory(filters),
    enabled: options?.enabled,
  })
}