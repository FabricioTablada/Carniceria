import { httpClient } from '@/lib/htpp/client'
import type {
  CreatePurchaseDto,
  PaginatedPurchasesResponse,
  Purchase,
  PurchaseFilters,
  UpdatePurchaseDto,
} from '../types/purchase.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const purchasesApi = {
  getPurchases: async (
    filters?: PurchaseFilters,
  ): Promise<PaginatedPurchasesResponse> => {
    const { data } = await httpClient.get<PaginatedPurchasesResponse>(
      '/purchases',
      { params: filters },
    )

    return data
  },

  getPurchaseById: async (id: string): Promise<Purchase> => {
    const { data } = await httpClient.get<ApiEnvelope<Purchase>>(
      `/purchases/${id}`,
    )

    return data.data
  },

  createPurchase: async (data: CreatePurchaseDto): Promise<Purchase> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Purchase>>(
      '/purchases',
      data,
    )

    return response.data
  },

  updatePurchase: async (
    id: string,
    data: UpdatePurchaseDto,
  ): Promise<Purchase> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Purchase>>(
      `/purchases/${id}`,
      data,
    )

    return response.data
  },
}