import { httpClient } from '@/lib/htpp/client'
import type { LookupResponse } from '@/types/lookup'
import type {
  ChangeSupplierStatusDto,
  CreateSupplierDto,
  PaginatedSuppliersResponse,
  Supplier,
  SupplierFilters,
  SupplierLookupFilters,
  UpdateSupplierDto,
} from '../types/supplier.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const suppliersApi = {
  getSuppliers: async (
    filters?: SupplierFilters,
  ): Promise<PaginatedSuppliersResponse> => {
    const { data } = await httpClient.get<PaginatedSuppliersResponse>(
      '/suppliers',
      { params: filters },
    )

    return data
  },

  // Arquitectura de selectores, Bloque 3: consume el patron de lookup del
  // backend (`GET /suppliers/lookup`, ya existente desde el Bloque 1), no
  // `GET /suppliers` — respuesta generica `{id,label}` (el selector de
  // proveedores solo necesita mostrar el nombre, sin campos extra).
  lookup: async (filters?: SupplierLookupFilters): Promise<LookupResponse> => {
    const { data } = await httpClient.get<LookupResponse>('/suppliers/lookup', {
      params: filters,
    })

    return data
  },

  getSupplierById: async (id: string): Promise<Supplier> => {
    const { data } = await httpClient.get<ApiEnvelope<Supplier>>(
      `/suppliers/${id}`,
    )

    return data.data
  },

  createSupplier: async (data: CreateSupplierDto): Promise<Supplier> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Supplier>>(
      '/suppliers',
      data,
    )

    return response.data
  },

  updateSupplier: async (
    id: string,
    data: UpdateSupplierDto,
  ): Promise<Supplier> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Supplier>>(
      `/suppliers/${id}`,
      data,
    )

    return response.data
  },

  updateSupplierStatus: async (
    id: string,
    data: ChangeSupplierStatusDto,
  ): Promise<Supplier> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Supplier>>(
      `/suppliers/${id}/status`,
      data,
    )

    return response.data
  },

  // DELETE /suppliers/:id responde 204 No Content, sin body (verificado
  // contra el backend real: suppliers.controller.ts -> `remove`, borrado
  // logico via Soft Delete). A diferencia del resto de los metodos de
  // este archivo, no hay ningun `ApiEnvelope` que leer -- el retorno es
  // `Promise<void>`, no un objeto `Supplier`.
  deleteSupplier: async (id: string): Promise<void> => {
    await httpClient.delete(`/suppliers/${id}`)
  },
}