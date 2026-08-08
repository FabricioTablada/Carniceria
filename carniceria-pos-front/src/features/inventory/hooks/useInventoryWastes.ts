import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { inventoryApi } from '../api/inventory.api'
import type {
  ListInventoryWasteFilters,
  PaginatedInventoryWasteResponse,
} from '../types/inventory.types'

/** Mismo criterio que `useInventory.ts`: `filters` incluye tanto los
 * filtros reales (sucursalId/productId/userId/reason) como la paginacion
 * (page/limit) en un solo objeto opcional, pasado tal cual a
 * `inventoryApi.getWastes` como query params.
 *
 * QA.2 (Inventario): `enabled` (opcional, `true` por defecto — mismo
 * criterio que `useInventory.ts`) permite a un consumidor posponer la
 * consulta hasta tener un `productId` real — sin esto,
 * `InventoryAdjustDrawer.tsx` disparaba `GET /inventory/waste?productId=`
 * (cadena vacia) en cada carga de `InventoryPage.tsx`, aun con el Drawer
 * cerrado, y el backend la rechazaba con 400 (`productId` invalido como
 * UUID) — error silencioso, sin ningun indicio visible para el usuario. */
export function useInventoryWastes(
  filters?: ListInventoryWasteFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<PaginatedInventoryWasteResponse, AxiosError>({
    queryKey: ['inventory', 'wastes', 'list', filters],
    queryFn: () => inventoryApi.getWastes(filters),
    enabled: options?.enabled,
  })
}
