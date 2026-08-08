import { httpClient } from '@/lib/htpp/client'
import type { LookupResponse } from '@/types/lookup'
import type {
  ChangeCustomerStatusDto,
  CreateCustomerDto,
  Customer,
  CustomerFilters,
  CustomerLookupFilters,
  PaginatedCustomersResponse,
  UpdateCustomerDto,
} from '../types/customer.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * features/customers/api/customers.api.ts
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo patron exacto que `suppliers.api.ts`.
 */
export const customersApi = {
  getCustomers: async (filters?: CustomerFilters): Promise<PaginatedCustomersResponse> => {
    const { data } = await httpClient.get<PaginatedCustomersResponse>('/customers', {
      params: filters,
    })

    return data
  },

  // Arquitectura de selectores, Bloque 1: consume el patron de lookup del
  // backend (`GET /customers/lookup`), no `GET /customers` — respuesta
  // generica `{id,label}`. Sin consumidor todavia (Bloque 8.3).
  lookup: async (filters?: CustomerLookupFilters): Promise<LookupResponse> => {
    const { data } = await httpClient.get<LookupResponse>('/customers/lookup', {
      params: filters,
    })

    return data
  },

  getCustomerById: async (id: string): Promise<Customer> => {
    const { data } = await httpClient.get<ApiEnvelope<Customer>>(`/customers/${id}`)

    return data.data
  },

  createCustomer: async (data: CreateCustomerDto): Promise<Customer> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Customer>>('/customers', data)

    return response.data
  },

  updateCustomer: async (id: string, data: UpdateCustomerDto): Promise<Customer> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Customer>>(
      `/customers/${id}`,
      data,
    )

    return response.data
  },

  updateCustomerStatus: async (id: string, data: ChangeCustomerStatusDto): Promise<Customer> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Customer>>(
      `/customers/${id}/status`,
      data,
    )

    return response.data
  },

  // DELETE /customers/:id responde 204 No Content, sin body — mismo
  // criterio que `suppliersApi.deleteSupplier`.
  deleteCustomer: async (id: string): Promise<void> => {
    await httpClient.delete(`/customers/${id}`)
  },
}
