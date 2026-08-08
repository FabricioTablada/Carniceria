import { httpClient } from '@/lib/htpp/client'
import type { LookupResponse } from '@/types/lookup'
import type {
  ChangeTaxStatusDto,
  CreateTaxDto,
  PaginatedTaxesResponse,
  Tax,
  TaxFilters,
  TaxLookupFilters,
  UpdateTaxDto,
} from '../types/tax.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const taxesApi = {
  getTaxes: async (filters?: TaxFilters): Promise<PaginatedTaxesResponse> => {
    const { data } = await httpClient.get<PaginatedTaxesResponse>('/taxes', {
      params: filters,
    })

    return data
  },

  // Arquitectura de selectores, Bloque 3: consume el patron de lookup del
  // backend (`GET /taxes/lookup`, ya existente desde el Bloque 1), no
  // `GET /taxes` — respuesta generica `{id,label}`. Impuestos se mantiene
  // como catalogo de referencia acotado: sigue siendo un `<Select>`
  // simple, solo cambia su fuente de datos.
  lookup: async (filters?: TaxLookupFilters): Promise<LookupResponse> => {
    const { data } = await httpClient.get<LookupResponse>('/taxes/lookup', {
      params: filters,
    })

    return data
  },

  getTaxById: async (id: string): Promise<Tax> => {
    const { data } = await httpClient.get<ApiEnvelope<Tax>>(`/taxes/${id}`)

    return data.data
  },

  createTax: async (data: CreateTaxDto): Promise<Tax> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Tax>>(
      '/taxes',
      data,
    )

    return response.data
  },

  updateTax: async (id: string, data: UpdateTaxDto): Promise<Tax> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Tax>>(
      `/taxes/${id}`,
      data,
    )

    return response.data
  },

  updateTaxStatus: async (
    id: string,
    data: ChangeTaxStatusDto,
  ): Promise<Tax> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Tax>>(
      `/taxes/${id}/status`,
      data,
    )

    return response.data
  },

  deleteTax: async (id: string): Promise<void> => {
    await httpClient.delete(`/taxes/${id}`)
  },
}