import { httpClient } from '@/lib/htpp/client'
import type {
  CreateInventoryDto,
  CreateInventoryWasteDto,
  Inventory,
  InventoryFilters,
  InventoryWaste,
  ListInventoryWasteFilters,
  PaginatedInventoryResponse,
  PaginatedInventoryWasteResponse,
  UpdateInventoryDto,
} from '../types/inventory.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const inventoryApi = {
  getInventory: async (
    filters?: InventoryFilters,
  ): Promise<PaginatedInventoryResponse> => {
    const { data } = await httpClient.get<PaginatedInventoryResponse>(
      '/inventory',
      { params: filters },
    )

    return data
  },

  getInventoryById: async (id: string): Promise<Inventory> => {
    const { data } = await httpClient.get<ApiEnvelope<Inventory>>(
      `/inventory/${id}`,
    )

    return data.data
  },

  createInventory: async (data: CreateInventoryDto): Promise<Inventory> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Inventory>>(
      '/inventory',
      data,
    )

    return response.data
  },

  updateInventory: async (
    id: string,
    data: UpdateInventoryDto,
  ): Promise<Inventory> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Inventory>>(
      `/inventory/${id}`,
      data,
    )

    return response.data
  },

  // Bloque 5.4: `POST /inventory/waste` — el modulo de Mermas se monta
  // DENTRO de `/inventory` en el backend (arquitectura aprobada, Bloque
  // 5.3), no bajo un prefijo propio.
  createWaste: async (data: CreateInventoryWasteDto): Promise<InventoryWaste> => {
    const { data: response } = await httpClient.post<ApiEnvelope<InventoryWaste>>(
      '/inventory/waste',
      data,
    )

    return response.data
  },

  // Bloque 1 (historial de mermas): consume `GET /inventory/waste`, ya
  // existente y funcional en el backend (paginado, con filtros
  // sucursalId/productId/userId/reason) — mismo criterio que
  // `getInventory` (filtros + pagina se pasan tal cual como query params).
  getWastes: async (
    filters?: ListInventoryWasteFilters,
  ): Promise<PaginatedInventoryWasteResponse> => {
    const { data } = await httpClient.get<PaginatedInventoryWasteResponse>(
      '/inventory/waste',
      { params: filters },
    )

    return data
  },

  // Bloque 1 (historial de mermas): consume `GET /inventory/waste/:id`,
  // ya existente y funcional en el backend. Mismo criterio que
  // `getInventoryById`.
  getWasteById: async (id: string): Promise<InventoryWaste> => {
    const { data } = await httpClient.get<ApiEnvelope<InventoryWaste>>(
      `/inventory/waste/${id}`,
    )

    return data.data
  },

  // Bloque "Eliminación de Mermas" (aprobado, ADMIN únicamente): consume
  // `DELETE /inventory/waste/:id`, `204 No Content` sin body — mismo
  // criterio que `suppliersApi.deleteSupplier`.
  deleteWaste: async (id: string): Promise<void> => {
    await httpClient.delete(`/inventory/waste/${id}`)
  },
}